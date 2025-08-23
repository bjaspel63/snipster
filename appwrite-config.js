// Appwrite Config
const client = new Appwrite.Client();

client
  .setEndpoint("https://syd.cloud.appwrite.io/v1") 
  .setProject("68a9eab60024173932c4");

// Database
const databases = new Appwrite.Databases(client);

// Export globally
window.databases = databases;
window.Appwrite = Appwrite;
