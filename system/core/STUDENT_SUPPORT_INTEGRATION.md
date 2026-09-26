# STUDENT SUPPORT INTEGRATION CONTRACT

## Goal
Wire the Student Support System into the same teacher experience without confusing support needs with course achievement.

## What support data may contain
- student_email
- course_id
- project_id or activity_id
- support_level (1-4)
- barrier / problem type
- support selected
- support attempts
- successful strategy
- teacher check-in requested
- outcome of support
- next support goal
- timestamp

## What support data must NOT do automatically
- assign a competency level
- change a Product / Observation / Conversation judgement
- create a PowerSchool grade
- label a student globally as a "1", "2", "3" or "4"

Support level is contextual and may differ by software, skill and task.

## Teacher dashboard integration
Add a second lens beside Evidence:

### Evidence
What has the student demonstrated?

### Support
What support does the student currently need to demonstrate learning independently?

Useful dashboard signals:
- no evidence yet
- repeated support requests
- same barrier recurring
- successful support strategy
- support fading over time
- teacher check-in requested
- competency strong but independence still developing
- independence strong but product evidence weak

## Gem / Opal bridge
Shared Gems/Opals can provide level-appropriate pathways, but the teacher dashboard should receive only an intentional support check-in record, not the full private conversation transcript.

Recommended student action:
`Make this work for me`

Possible transformations:
- shorten / sequence directions
- convert video to checklist
- create a "do with me" sequence
- define unfamiliar terms
- show one worked example
- create a troubleshooting checklist
- request teacher check-in

The support system should record which transformation was used and whether it helped.

## Integration key
Use the same `student_email`, `course_id`, `project_id`, and where applicable `skill_id` as the Technology Evidence System so both views can be joined without duplicating students or projects.
