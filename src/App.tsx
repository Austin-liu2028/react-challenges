import { useEffect, useState } from 'react';
import { hasConflict } from './conflicts';

type Course = {
  term: string;
  number: string;
  meets: string;
  title: string;
};

type Term = 'Fall' | 'Winter' | 'Spring';

type Schedule = {
  title: string;
  courses: Record<string, Course>;
};

type CourseFormState = {
  term: Term;
  number: string;
  title: string;
  meets: string;
};

type CourseWithId = Course & { id: string };

const terms: Term[] = ['Fall', 'Winter', 'Spring'];
const emptyCourseForm: CourseFormState = {
  term: 'Fall',
  number: '',
  title: '',
  meets: '',
};

const App = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term>('Fall');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [courseForm, setCourseForm] = useState<CourseFormState>(emptyCourseForm);

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((selected) =>
      selected.indexOf(courseId) !== -1
        ? selected.filter((id) => id !== courseId)
        : [...selected, courseId]
    );
  };

  const updateCourseForm = <K extends keyof CourseFormState>(
    field: K,
    value: CourseFormState[K]
  ) => {
    setCourseForm((current) => ({ ...current, [field]: value }));
  };

  const isCourseUnavailable = (course: CourseWithId) => {
    if (selectedCourses.indexOf(course.id) !== -1) {
      return false;
    }

    return selectedCourses.some((selectedId) => {
      const selectedCourse = schedule?.courses[selectedId];

      if (!selectedCourse) {
        return false;
      }

      return hasConflict(course, {
        term: selectedCourse.term,
        meets: selectedCourse.meets,
      });
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

  const courseList: CourseWithId[] = Object.keys(courses).map((id) => ({
    id,
    ...courses[id],
  }));

  const filteredCourses = courseList.filter(
    (course) => course.term === selectedTerm
  );

  const selectedCourseList = courseList.filter(
    (course) => selectedCourses.indexOf(course.id) !== -1
  );

  const handleAddCourse = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const number = courseForm.number.trim();
    const title = courseForm.title.trim();
    const meets = courseForm.meets.trim();

    if (!number || !title) {
      return;
    }

    const newCourseId = `course-${Date.now()}`;
    const newCourse: Course = {
      term: courseForm.term,
      number,
      title,
      meets,
    };

    setSchedule((currentSchedule) => {
      if (!currentSchedule) {
        return currentSchedule;
      }

      return {
        ...currentSchedule,
        courses: {
          ...currentSchedule.courses,
          [newCourseId]: newCourse,
        },
      };
    });

    setSelectedTerm(courseForm.term);
    setCourseForm(emptyCourseForm);
    setShowForm(false);
  };

  return (
    <main className="p-3">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Add Course
          </button>

          <button
            type="button"
            onClick={() => setShowPlan(true)}
            className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
          >
            Course Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCourses.map(({ id, term, number, meets, title: courseTitle }) => {
          const isSelected = selectedCourses.indexOf(id) !== -1;
          const isUnavailable = !isSelected && isCourseUnavailable({ id, term, number, meets, title: courseTitle });

          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${term} CS ${number}: ${courseTitle}`}
              disabled={isUnavailable}
              onClick={() => toggleCourse(id)}
              className={[
                'flex min-h-40 w-full flex-col rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-blue-600 bg-blue-100 shadow-md ring-2 ring-blue-200'
                  : isUnavailable
                    ? 'cursor-not-allowed border-red-300 bg-red-50 text-red-700 opacity-75'
                    : 'border-gray-300 bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="text-lg font-medium">
                  {term} CS {number}
                </h2>

                {isUnavailable && (
                  <span className="rounded bg-red-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-red-700">
                    Unavailable
                  </span>
                )}
              </div>

              <p className="mt-2">{courseTitle}</p>

              <footer className="mt-auto border-t border-gray-300 pt-3 text-sm">
                {meets}
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

      {showForm && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg"
            onClick={(event) => event.stopPropagation()}
            onSubmit={handleAddCourse}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Add a Course</h2>

              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border px-3 py-1"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="course-term" className="mb-1 block font-medium">
                  Course term
                </label>
                <select
                  id="course-term"
                  value={courseForm.term}
                  onChange={(event) =>
                    updateCourseForm('term', event.target.value as Term)
                  }
                  className="w-full rounded border border-gray-300 px-3 py-2"
                >
                  {terms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="course-number" className="mb-1 block font-medium">
                  Course number
                </label>
                <input
                  id="course-number"
                  type="text"
                  value={courseForm.number}
                  onChange={(event) => updateCourseForm('number', event.target.value)}
                  placeholder="e.g. 397"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="course-title" className="mb-1 block font-medium">
                  Course title
                </label>
                <input
                  id="course-title"
                  type="text"
                  value={courseForm.title}
                  onChange={(event) => updateCourseForm('title', event.target.value)}
                  placeholder="e.g. Intro to React"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>

              <div>
                <label htmlFor="course-meets" className="mb-1 block font-medium">
                  Meeting days and times
                </label>
                <input
                  id="course-meets"
                  type="text"
                  value={courseForm.meets}
                  onChange={(event) => updateCourseForm('meets', event.target.value)}
                  placeholder="e.g. MWF 11:00-11:50"
                  className="w-full rounded border border-gray-300 px-3 py-2"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded border border-gray-300 px-4 py-2"
              >
                Cancel
              </button>

              <button
                type="submit"
                className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
              >
                Save Course
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
};

export default App;