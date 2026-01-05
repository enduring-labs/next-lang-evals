import { put } from '@vercel/blob';

/**
 * Generate a timestamp prefix for blob filenames (for cleanup purposes)
 * Format: YYYY-MM-DD-HH-mm-ss
 * Since Vercel Blob doesn't support TTL, we include timestamp in filename for manual cleanup
 */
export function generateTimestampPrefix(): string {
  const now = new Date();
  return now
    .toISOString()
    .replace(/[:.]/g, '-')
    .split('T')
    .join('-')
    .split('Z')[0];
}

/**
 * Store data in Vercel Blob storage and return the URL
 * @param key - Unique identifier for the data
 * @param data - Data to store (will be JSON stringified)
 * @param contentType - Content type (defaults to application/json)
 * @returns Promise<string> - The blob URL
 */
export async function storeDataInBlob(
  key: string,
  data: any,
  contentType: string = 'application/json',
): Promise<string> {
  try {
    const jsonData = JSON.stringify(data, null, 2);
    const timestamp = generateTimestampPrefix();
    const filename = `${timestamp}-${key}.json`;

    const blob = await put(filename, jsonData, {
      access: 'public',
      token: process.env.BLOB_READ_WRITE_TOKEN!,
      contentType,
      addRandomSuffix: true,
    });

    console.log(`Data stored successfully in blob: ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error(`Failed to store data in blob for key ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieve data from Vercel Blob storage using URL
 * @param blobUrl - The blob URL to fetch data from
 * @returns Promise<any> - The parsed JSON data
 */
export async function retrieveDataFromBlob(blobUrl: string): Promise<any> {
  try {
    const response = await fetch(blobUrl);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch blob data: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log(`Data retrieved successfully from blob: ${blobUrl}`);
    return data;
  } catch (error) {
    console.error(`Failed to retrieve data from blob ${blobUrl}:`, error);
    throw error;
  }
}

