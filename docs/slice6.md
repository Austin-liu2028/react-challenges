# Time Conflicts

Prevent users from selecting courses that conflict with courses they have already selected.

Two courses conflict if they are in the same term, have at least one meeting day in common, and their meeting times overlap.

Courses with an empty meeting time should never conflict.

A course that conflicts with a selected course should not be selectable and should have a clear visual indication that it is unavailable.

The unavailable state should update immediately when courses are selected or unselected.

Keep the conflict detection logic in short, well-named utility functions in a separate file.