/**
 * 検証用 login_id フォールバックの回帰。
 * Run: node --experimental-strip-types lib/v2/assessment/aiEvaluationVerificationAccounts.test.ts
 */
import assert from "node:assert/strict";
import {
  isKnownVerificationStudentLoginId,
  KNOWN_VERIFICATION_STUDENT_LOGIN_IDS,
} from "./aiEvaluationVerificationAccounts";
import { classifyAccountKind } from "./aiEvaluationTargetSelection";

{
  assert.equal(isKnownVerificationStudentLoginId("12515054"), false);
  assert.equal(
    (KNOWN_VERIFICATION_STUDENT_LOGIN_IDS as readonly string[]).includes(
      "12515054",
    ),
    false,
  );
  assert.equal(classifyAccountKind(false), "real_student");
}

{
  assert.equal(isKnownVerificationStudentLoginId("19810719"), true);
  assert.equal(isKnownVerificationStudentLoginId("student01"), true);
  assert.equal(isKnownVerificationStudentLoginId("99999991"), true);
}

console.log("aiEvaluationVerificationAccounts.test.ts: all assertions passed");
