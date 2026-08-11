import { cleanE2eFixtures } from "./database";

export default async function globalTeardown() {
  await cleanE2eFixtures();
}
