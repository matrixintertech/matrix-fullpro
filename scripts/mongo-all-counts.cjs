const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;

async function main() {
  if (!uri) {
    throw new Error("Missing MONGO_URI. Set it in your environment before running this script.");
  }
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("matrix");
  const collections = await db.listCollections().toArray();
  const names = collections.map((c) => c.name).sort();
  const out = {};
  for (const name of names) {
    out[name] = await db.collection(name).countDocuments();
  }
  console.log(JSON.stringify(out, null, 2));
  await client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
