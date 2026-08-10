import { seedE2eFixtures } from "./database";

export default async function globalSetup() {
  await seedE2eFixtures();
}
