import { MembershipRole, NodeKind, PrismaClient, TraceAction, TraceActor } from "@prisma/client";

const prisma = new PrismaClient();

const demoNotes = [
  { text: "Capture kickoff agenda", x: -120, y: -40 },
  { text: "Summarize discovery calls", x: 40, y: -60 },
  { text: "Draft investor update", x: 220, y: -40 },
  { text: "Outline launch blog", x: -200, y: 120 },
  { text: "Prepare demo script", x: -40, y: 140 },
  { text: "Design feature roadmap", x: 140, y: 160 },
  { text: "Collect competitor research", x: -260, y: 260 },
  { text: "Customer feedback synthesis", x: -80, y: 260 },
  { text: "QA checklist items", x: 120, y: 260 },
  { text: "Marketing channel experiments", x: 260, y: 120 },
  { text: "Partner outreach targets", x: 220, y: -180 },
  { text: "Success metrics for launch", x: 20, y: -200 },
];

async function main() {
  console.log("\n✨ Seeding CollabCanvas demo data...\n");

  await prisma.trace.deleteMany();
  await prisma.node.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.board.deleteMany();
  await prisma.user.deleteMany();

  const owner = await prisma.user.create({
    data: {
      email: "founder@collabcanvas.ai",
      name: "Canvas Founder",
    },
  });

  const board = await prisma.board.create({
    data: {
      title: "Launch Planning Board",
      ownerId: owner.id,
    },
  });

  await prisma.membership.create({
    data: {
      boardId: board.id,
      userId: owner.id,
      role: MembershipRole.OWNER,
    },
  });

  const createdNodeIds: string[] = [];

  for (const [index, note] of demoNotes.entries()) {
    const node = await prisma.node.create({
      data: {
        boardId: board.id,
        kind: NodeKind.STICKY,
        x: note.x,
        y: note.y,
        content: {
          text: note.text,
          author: index % 3 === 0 ? "Sarah" : index % 3 === 1 ? "Leo" : "Avery",
        },
      },
    });
    createdNodeIds.push(node.id);
  }

  await prisma.trace.createMany({
    data: [
      {
        boardId: board.id,
        actor: TraceActor.AI,
        action: TraceAction.CLUSTER,
        prompt: { boardId: board.id, nodeIds: createdNodeIds.slice(0, 6) },
        response: {
          assignments: createdNodeIds.slice(0, 6).map((nodeId, idx) => ({
            nodeId,
            clusterId: `cluster-${idx % 3}`,
          })),
          embeddingsMs: 640,
        },
        latencyMs: 1200,
        model: "gpt-4.1-mini",
        tokensIn: 1024,
        tokensOut: 356,
      },
      {
        boardId: board.id,
        actor: TraceActor.USER,
        userId: owner.id,
        action: TraceAction.OUTLINE,
        prompt: { boardId: board.id, clusterId: "cluster-0", style: "concise" },
        response: {
          outlineNodes: [
            { title: "Launch objectives", x: 420, y: -60 },
            { title: "Timeline checkpoints", x: 420, y: 40 },
          ],
          latencyMs: 980,
        },
        latencyMs: 980,
        model: "gpt-4.1-mini",
        tokensIn: 684,
        tokensOut: 212,
      },
    ],
  });

  console.log(`Seeded user ${owner.email} with board "${board.title}" (${board.id}).`);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log("\n✅ Seed complete\n");
  });
