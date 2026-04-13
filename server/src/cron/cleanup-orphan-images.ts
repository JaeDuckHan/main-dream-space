import "dotenv/config";
import { query } from "../db.js";
import { deleteImage } from "../lib/upload.js";

export async function cleanupOrphanImages() {
  const images = await query<{ id: number; relative_path: string }>(
    `SELECT id, relative_path
     FROM community_images
     WHERE post_id IS NULL
       AND created_at < NOW() - INTERVAL '24 hours'
     ORDER BY created_at ASC
     LIMIT 200`,
  );

  let deleted = 0;
  for (const image of images) {
    try {
      await deleteImage(image.relative_path);
      await query("DELETE FROM community_images WHERE id = $1", [image.id]);
      deleted += 1;
    } catch (error) {
      console.error(`[cleanup] failed for image ${image.id}`, error);
    }
  }

  return { scanned: images.length, deleted };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  cleanupOrphanImages()
    .then((result) => {
      console.log(`[cleanup] scanned=${result.scanned} deleted=${result.deleted}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
