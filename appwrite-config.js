// Initialize Appwrite client
const client = new Appwrite.Client()

client
  .setEndpoint("https://syd.cloud.appwrite.io/v1") // Appwrite endpoint
  .setProject("Y68a9eab60024173932c4");                   // Project ID

// Services
const account = new Appwrite.Account(client);
const databases = new Appwrite.Databases(client);

// Collection ID
const COLLECTION_ID = "user_snippets";
