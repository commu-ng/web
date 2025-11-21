import "dotenv/config";
import TurndownService from "turndown";
import { isNotNull, eq } from "drizzle-orm";
import { batchDb } from "../db";
import { community, communityApplication } from "../drizzle/schema";

const turndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
});

// Configure turndown to handle common HTML from Tiptap
turndownService.addRule("removeEmptyParagraphs", {
  filter: (node) => {
    return (
      node.nodeName === "P" &&
      node.textContent?.trim() === "" &&
      !node.querySelector("img")
    );
  },
  replacement: () => "",
});

async function migrateHtmlToMarkdown() {
  console.log("Starting HTML to Markdown migration...");

  try {
    // Migrate community descriptions
    console.log("\nMigrating community descriptions...");
    const communities = await batchDb
      .select({
        id: community.id,
        name: community.name,
        description: community.description,
      })
      .from(community)
      .where(isNotNull(community.description));

    console.log(`Found ${communities.length} communities with descriptions`);

    for (const comm of communities) {
      if (comm.description) {
        const markdown = turndownService.turndown(comm.description);
        await batchDb
          .update(community)
          .set({ description: markdown })
          .where(eq(community.id, comm.id));
        console.log(`✓ Converted description for community: ${comm.name}`);
      }
    }

    // Migrate application messages
    console.log("\nMigrating application messages...");
    const applications = await batchDb
      .select({
        id: communityApplication.id,
        message: communityApplication.message,
      })
      .from(communityApplication)
      .where(isNotNull(communityApplication.message));

    console.log(`Found ${applications.length} applications with messages`);

    for (const app of applications) {
      if (app.message) {
        const markdown = turndownService.turndown(app.message);
        await batchDb
          .update(communityApplication)
          .set({ message: markdown })
          .where(eq(communityApplication.id, app.id));
        console.log(`✓ Converted message for application: ${app.id}`);
      }
    }

    console.log("\n✅ Migration completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    process.exit(0);
  }
}

migrateHtmlToMarkdown();
