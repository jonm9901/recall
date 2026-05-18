import {
  RekognitionClient,
  IndexFacesCommand,
  DetectLabelsCommand,
  SearchFacesCommand,
  CreateCollectionCommand,
  DescribeCollectionCommand,
} from "@aws-sdk/client-rekognition";

function getClient(): RekognitionClient {
  return new RekognitionClient({
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function ensureCollection(): Promise<void> {
  const client = getClient();
  const collectionId = process.env.REKOGNITION_COLLECTION_ID!;
  try {
    await client.send(new DescribeCollectionCommand({ CollectionId: collectionId }));
  } catch (err: unknown) {
    if ((err as { name?: string }).name === "ResourceNotFoundException") {
      await client.send(new CreateCollectionCommand({ CollectionId: collectionId }));
      console.log(`   Created Rekognition collection: ${collectionId}`);
    } else {
      throw err;
    }
  }
}

export interface LabelResult {
  tag: string;
  confidence: number;
}

export async function detectLabels(imageBytes: Uint8Array): Promise<LabelResult[]> {
  const client = getClient();
  const res = await client.send(
    new DetectLabelsCommand({
      Image: { Bytes: imageBytes },
      MinConfidence: 70,
      MaxLabels: 30,
    })
  );
  return (res.Labels ?? []).map((l) => ({
    tag: l.Name!,
    confidence: l.Confidence! / 100,
  }));
}

export interface FaceResult {
  faceId: string;
  confidence: number;
  boundingBoxTop: number;
  boundingBoxLeft: number;
  boundingBoxWidth: number;
  boundingBoxHeight: number;
}

export async function indexFaces(imageBytes: Uint8Array): Promise<FaceResult[]> {
  const client = getClient();
  const res = await client.send(
    new IndexFacesCommand({
      CollectionId: process.env.REKOGNITION_COLLECTION_ID!,
      Image: { Bytes: imageBytes },
      DetectionAttributes: [],
      QualityFilter: "AUTO",
      MaxFaces: 20,
    })
  );
  return (res.FaceRecords ?? []).map((r) => ({
    faceId: r.Face!.FaceId!,
    confidence: r.Face!.Confidence!,
    boundingBoxTop: r.Face!.BoundingBox!.Top!,
    boundingBoxLeft: r.Face!.BoundingBox!.Left!,
    boundingBoxWidth: r.Face!.BoundingBox!.Width!,
    boundingBoxHeight: r.Face!.BoundingBox!.Height!,
  }));
}

export interface FaceMatch {
  faceId: string;
  similarity: number;
}

// Find similar faces already in the collection (excludes the queried face itself)
export async function searchSimilarFaces(faceId: string): Promise<FaceMatch[]> {
  const client = getClient();
  try {
    const res = await client.send(
      new SearchFacesCommand({
        CollectionId: process.env.REKOGNITION_COLLECTION_ID!,
        FaceId: faceId,
        FaceMatchThreshold: 85,
        MaxFaces: 5,
      })
    );
    return (res.FaceMatches ?? []).map((m) => ({
      faceId: m.Face!.FaceId!,
      similarity: m.Similarity!,
    }));
  } catch {
    return [];
  }
}

// Lower-threshold variant for surfacing merge suggestions (75%)
export async function findSimilarClusters(faceId: string): Promise<FaceMatch[]> {
  const client = getClient();
  try {
    const res = await client.send(
      new SearchFacesCommand({
        CollectionId: process.env.REKOGNITION_COLLECTION_ID!,
        FaceId: faceId,
        FaceMatchThreshold: 75,
        MaxFaces: 20,
      })
    );
    return (res.FaceMatches ?? []).map((m) => ({
      faceId: m.Face!.FaceId!,
      similarity: m.Similarity!,
    }));
  } catch {
    return [];
  }
}
