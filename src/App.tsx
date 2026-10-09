import { useEffect, useState } from 'react';

type Course = {
  term: string;
  number: string;
  meets: string;
  title: string;
};

type Schedule = {
  title: string;
  courses: Record<string, Course>;
};

const App = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedTerm, setSelectedTerm] = useState('Fall');

  useEffect(() => {
    fetch('https://courses.cs.northwestern.edu/394/guides/data/cs-courses.php')
      .then((response) => response.json())
      .then((data) => setSchedule(data));
  }, []);

  if (!schedule) {
    return <p className="p-3">Loading...</p>;
  }

  const { title, courses } = schedule;

  const courseList: Course[] = Object.keys(courses).map(
    (key) => courses[key]
  );

  const filteredCourses = courseList.filter(
    (course) => course.term === selectedTerm
  );

  return (
    <main className="p-3">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setSelectedTerm('Fall')}
          className="rounded border px-4 py-2"
        >
          Fall
        </button>

        <button
          onClick={() => setSelectedTerm('Winter')}
          className="rounded border px-4 py-2"
        >
          Winter
        </button>

        <button
          onClick={() => setSelectedTerm('Spring')}
          className="rounded border px-4 py-2"
        >
          Spring
        </button>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCourses.map(
          ({ term, number, meets, title: courseTitle }) => (
            <article
              key={`${term}-${number}`}
              className="flex min-h-40 flex-col rounded-lg border border-gray-300 p-4"
            >
              <h2 className="text-lg font-medium">
                {term} CS {number}
              </h2>

              <p className="mt-2">{courseTitle}</p>

              <footer className="mt-auto border-t border-gray-300 pt-3 text-sm">
                {meets}
              </footer>
            </article>
          )
        )}
      </div>
    </main>
  );
};

export default App;