import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URI;
if (!uri) {
  throw new Error('MONGO_URI environment variable is not set');
}

let client;
let clientPromise;

/**
 * Returns a singleton connected MongoClient instance.
 * Connects on first call, reuses thereafter.
 * Do NOT close client connection on each request.
 */


export async function getClient() {
  if (!client) {
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    clientPromise = client.connect().catch((error) => {
      client = undefined;

      if (error.code === 'ECONNREFUSED' && error.syscall === 'querySrv') {
        throw new Error(
          'MongoDB Atlas DNS lookup failed. Your network is refusing SRV DNS queries for the mongodb+srv URI. Try another network, change Windows DNS to 8.8.8.8/1.1.1.1, or use the non-SRV mongodb:// connection string from Atlas.'
        );
      }

      throw error;
    });
  }

  await clientPromise;
  return client;
}
