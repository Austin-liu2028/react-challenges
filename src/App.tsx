import { useEffect, useState } from 'react';
import { hasConflict, type Course } from './conflicts';

type CourseRecord = Course & {
  number: string;
  title: string;
};

type Term = 'Fall' | 'Winter' | 'Spring';

type Schedule = {
  title: string;
  courses: Record<string, CourseRecord>;
};

const terms: Term[] = ['Fall', 'Winter', 'Spring'];

const App = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term>('Fall');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [showPlan, setShowPlan] = useState(false);

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((selected) => {
      if (selected.indexOf(courseId) !== -1) {
        return selected.filter((id) => id !== courseId);
      }

      const course = schedule?.courses[courseId];

      if (!course) {
        return selected;
      }

      const hasSelectedConflict = selected.some(
        (selectedId) => hasConflict(course, schedule!.courses[selectedId])
      );

      if (hasSelectedConflict) {
        return selected;
      }

      return [...selected, courseId];
    });
  };

  useEffect(() => {
    fetch('https://courses.cs.northwestern.edu/394/guides/data/cs-courses.php')
      .then((response) => response.json())
      .then((data) => setSchedule(data));
  }, []);

  if (!schedule) {
    return <p className="p-3">Loading...</p>;
  }

  const { title, courses } = schedule;

  const courseList = Object.keys(courses).map((id) => ({
    id,
    ...courses[id],
  }));

  const filteredCourses = courseList.filter(
    (course) => course.term === selectedTerm
  );

  const selectedCourseList = courseList.filter(
    (course) => selectedCourses.indexOf(course.id) !== -1
  );

  return (
    <main className="p-3">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex gap-2">
          {terms.map((term) => {
            const isSelected = term === selectedTerm;

            return (
              <button
                key={term}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedTerm(term)}
                className={[
                  'rounded border px-4 py-2 transition-colors',
                  isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
                ].join(' ')}
              >
                {term}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowPlan(true)}
          className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
        >
          Course Plan
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCourses.map(({ id, term, number, meets, title: courseTitle }) => {
          const isSelected = selectedCourses.indexOf(id) !== -1;
          const unavailable =
            !isSelected &&
            selectedCourses.some(
              (selectedId) =>
                hasConflict(courses[id], courses[selectedId]) && selectedId !== id
            );

          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              aria-disabled={unavailable}
              disabled={unavailable}
              onClick={() => toggleCourse(id)}
              className={[
                'flex min-h-40 w-full flex-col rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-blue-600 bg-blue-100 shadow-md ring-2 ring-blue-200'
                  : unavailable
                    ? 'cursor-not-allowed border-red-300 bg-red-50 text-red-500 opacity-60'
                    : 'border-gray-300 bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              <h2 className="text-lg font-medium">
                {term} CS {number}
              </h2>

              <p className="mt-2">{courseTitle}</p>

              <footer className="mt-auto border-t border-gray-300 pt-3 text-sm">
                {meets || 'No meeting time'}
              </footer>
            </button>
          );
        })}
      </div>

      {showPlan && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowPlan(false)}
        >
          <div
            className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Course Plan</h2>

              <button
                type="button"
                onClick={() => setShowPlan(false)}
                className="rounded border px-3 py-1"
              >
                Close
              </button>
            </div>

            {selectedCourseList.length === 0 ? (
              <p>
                No courses selected. Click a course card to add it to your course plan.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedCourseList.map((course) => (
                  <div
                    key={course.id}
                    className="rounded border border-gray-300 p-3"
                  >
                    <h3 className="font-medium">
                      {course.term} CS {course.number}
                    </h3>

                    <p>{course.title}</p>
                    <p className="text-sm">{course.meets}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
};

export default App;