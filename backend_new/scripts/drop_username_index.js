// One-time script to drop legacy username index from users collection
// Usage: node scripts/drop_username_index.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartai';
  console.log(`Connecting to MongoDB: ${uri}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const collection = db.collection('users');

  try {
    const indexes = await collection.indexes();
    const usernameIndexes = indexes.filter(ix => ix.key && Object.prototype.hasOwnProperty.call(ix.key, 'username'));

    if (usernameIndexes.length === 0) {
      console.log('No username-based indexes found. Nothing to drop.');
    } else {
      for (const ix of usernameIndexes) {
        const name = ix.name;
        console.log(`Dropping index: ${name} ->`, ix.key);
        await collection.dropIndex(name);
      }
      console.log('Dropped legacy username index(es) successfully.');
    }
  } catch (err) {
    console.error('Error while inspecting/dropping indexes:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}

run();
