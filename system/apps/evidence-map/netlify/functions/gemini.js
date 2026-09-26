// This release has no user accounts. Keep the former unauthenticated AI proxy disabled.
// Rule-based rubric drafts remain available locally. A future authenticated service must
// validate identity, allowed models, payload sizes and usage limits before upstream calls.
exports.handler = async () => ({
  statusCode: 403,
  headers: {'Content-Type':'application/json','Cache-Control':'no-store'},
  body: JSON.stringify({error:'disabled_in_local_teacher_release'})
});
