import { validateCoachExamples } from "../lib/patientFacingData";

const results = validateCoachExamples();
const failures = results.filter((r) => !r.ok);

console.log(`Coach example validation: ${results.length} checked, ${failures.length} failed`);

if (failures.length > 0) {
  for (const f of failures) {
    console.error(
      `[FAIL] ${f.patientId} / ${f.topicId}\n  Q: ${f.question}\n  expected: ${f.topicId}, got: ${f.detected}`,
    );
  }
  process.exit(1);
}

console.log("All Coach example questions map to their intended topics.");
