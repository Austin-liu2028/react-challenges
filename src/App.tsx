import { useEffect, useState } from 'react';

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

const terms: Term[] = ['Fall', 'Winter', 'Spring'];

const App = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term>('Fall');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);

  const toggleCourse = (courseId: string) => {
    setSelectedCourses((selected) =>
      selected.indexOf(courseId) !== -1
        ? selected.filter((id) => id !== courseId)
        : [...selected, courseId]
    );
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

  return (
    <main className="p-3">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>

      <div className="mb-4 flex gap-2">
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

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCourses.map(({ id, term, number, meets, title: courseTitle }) => {
          const isSelected = selectedCourses.indexOf(id) !== -1;

          return (
            <button
              key={id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => toggleCourse(id)}
              className={[
                'flex min-h-40 w-full flex-col rounded-lg border p-4 text-left transition-all',
                isSelected
                  ? 'border-blue-600 bg-blue-100 shadow-md ring-2 ring-blue-200'
                  : 'border-gray-300 bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              <h2 className="text-lg font-medium">
                {term} CS {number}
              </h2>

              <p className="mt-2">{courseTitle}</p>

              <footer className="mt-auto border-t border-gray-300 pt-3 text-sm">
                {meets}
              </footer>
            </button>
          );
        })}
      </div>
    </main>
  );
};

export default App;