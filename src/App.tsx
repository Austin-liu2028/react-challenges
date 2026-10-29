import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { addDoc, collection, getDocs } from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { get, ref, set } from 'firebase/database';

import { auth, db, realtimeDb } from './firebase';
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

const terms: Term[] = ['Fall', 'Winter', 'Spring'];

const defaultFormState: CourseFormState = {
  term: 'Fall',
  number: '',
  title: '',
  meets: '',
};

const buildCourseList = (courses: Record<string, Course>) =>
  Object.keys(courses).map((id) => ({
    id,
    ...courses[id],
  }));

const isValidMeetingDays = (days: string) => {
  const tokens = days.match(/Tu|Th|M|W|F/g) ?? [];

  return tokens.length > 0 && days === tokens.join('');
};

const isValidMeetingTime = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) {
    return false;
  }

  const match = trimmed.match(/^([A-Za-z]+)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);

  if (!match) {
    return false;
  }

  return isValidMeetingDays(match[1]);
};

const getFormValidationError = (values: CourseFormState) => {
  if (!values.number.trim()) {
    return 'Course number is required.';
  }

  if (!values.title.trim()) {
    return 'Course title is required.';
  }

  if (!isValidMeetingTime(values.meets)) {
    return 'Meeting time must use a valid format such as MWF 11:00-11:50 or TuTh 14:00-15:20.';
  }

  return '';
};

const hasDuplicateCourse = (
  courses: Record<string, Course>,
  course: Course,
  excludedCourseId?: string
) =>
  Object.keys(courses).some((courseId) => {
    const existingCourse = courses[courseId];

    return (
      courseId !== excludedCourseId &&
      existingCourse.term === course.term &&
      existingCourse.number.trim().toLowerCase() === course.number.trim().toLowerCase() &&
      existingCourse.title.trim().toLowerCase() === course.title.trim().toLowerCase() &&
      existingCourse.meets.trim() === course.meets.trim()
    );
  });

const getSavedCourseMap = async (uid: string) => {
  const snapshot = await getDocs(collection(db, 'users', uid, 'courses'));

  return snapshot.docs.reduce<Record<string, Course>>((accumulator, doc) => {
    const rawCourse = doc.data() as Partial<Course>;
    const term = rawCourse.term ?? '';
    const number = rawCourse.number ?? '';
    const title = rawCourse.title ?? '';
    const meets = rawCourse.meets ?? '';

    if (term && number && title && meets) {
      accumulator[doc.id] = {
        term: String(term),
        number: String(number),
        title: String(title),
        meets: String(meets),
      };
    }

    return accumulator;
  }, {});
};

const getSavedCourseEdits = async (uid: string) => {
  if (!realtimeDb) {
    return {};
  }

  const snapshot = await get(ref(realtimeDb, `users/${uid}/courseEdits`));
  const savedEdits = snapshot.val() as Record<string, Partial<Course>> | null;

  return Object.keys(savedEdits ?? {}).reduce<Record<string, Course>>(
    (accumulator, courseId) => {
      const savedCourse = savedEdits?.[courseId];

      if (
        savedCourse &&
        typeof savedCourse.term === 'string' &&
        typeof savedCourse.number === 'string' &&
        typeof savedCourse.title === 'string' &&
        typeof savedCourse.meets === 'string'
      ) {
        accumulator[courseId] = {
          term: savedCourse.term,
          number: savedCourse.number,
          title: savedCourse.title,
          meets: savedCourse.meets,
        };
      }

      return accumulator;
    },
    {}
  );
};

const App = () => {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [selectedTerm, setSelectedTerm] = useState<Term>('Fall');
  const [selectedCourses, setSelectedCourses] = useState<string[]>([]);
  const [showPlan, setShowPlan] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<CourseFormState>(defaultFormState);
  const [formError, setFormError] = useState('');
  const [databaseError, setDatabaseError] = useState('');
  const [authError, setAuthError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const initializeScheduler = async () => {
      let savedCourses: Record<string, Course> = {};
      let savedEdits: Record<string, Course> = {};

      try {
        const response = await fetch(
          'https://courses.cs.northwestern.edu/394/guides/data/cs-courses.php'
        );

        if (!response.ok) {
          throw new Error('The course catalog did not load.');
        }

        const data = (await response.json()) as Schedule;

        if (!active) {
          return;
        }

        setSchedule(data);
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error ? error.message : 'The course catalog could not be loaded.';

        setDatabaseError(`Could not load the course catalog: ${message}`);
      }

      let uid: string | null = null;

      try {
        const user = auth.currentUser ?? (await signInAnonymously(auth)).user;
        uid = user.uid;
      } catch (error) {
        if (!active) {
          return;
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Anonymous sign-in failed.';

        setAuthError(`Authentication failed: ${message}`);
      }

      if (uid) {
        try {
          savedCourses = await getSavedCourseMap(uid);
        } catch (error) {
          if (!active) {
            return;
          }

          const message =
            error instanceof Error ? error.message : 'Saved Firestore courses could not be loaded.';

          setDatabaseError((current) =>
            [current, `Could not load saved Firestore courses: ${message}`]
              .filter(Boolean)
              .join(' ')
          );
        }

        if (realtimeDb) {
          try {
            savedEdits = await getSavedCourseEdits(uid);
          } catch (error) {
            if (!active) {
              return;
            }

            const message =
              error instanceof Error
                ? error.message
                : 'Saved Realtime Database edits could not be loaded.';

            setDatabaseError((current) =>
              [current, `Could not load saved Realtime Database edits: ${message}`]
                .filter(Boolean)
                .join(' ')
            );
          }
        } else {
          setDatabaseError((current) =>
            [
              current,
              'Realtime Database is not configured. Set VITE_FIREBASE_DATABASE_URL to enable course edits.',
            ]
              .filter(Boolean)
              .join(' ')
          );
        }
      }

      if (active) {
        setSchedule((currentSchedule) => {
          const previousCourses = currentSchedule?.courses ?? {};

          return {
            title: currentSchedule?.title ?? 'Course Schedule',
            courses: {
              ...previousCourses,
              ...savedCourses,
              ...savedEdits,
            },
          };
        });
        setIsLoading(false);
      }
    };

    void initializeScheduler();

    return () => {
      active = false;
    };
  }, []);

  const courseList = useMemo(
    () => (schedule ? buildCourseList(schedule.courses) : []),
    [schedule]
  );

  const filteredCourses = useMemo(
    () => courseList.filter((course) => course.term === selectedTerm),
    [courseList, selectedTerm]
  );

  const selectedCourseMap = useMemo(() => {
    const selectedCoursesById: Record<string, Course & { id: string }> = {};

    courseList
      .filter((course) => selectedCourses.indexOf(course.id) !== -1)
      .forEach((course) => {
        selectedCoursesById[course.id] = course;
      });

    return selectedCoursesById;
  }, [courseList, selectedCourses]);

  const selectedCourseList = useMemo(
    () => courseList.filter((course) => selectedCourses.indexOf(course.id) !== -1),
    [courseList, selectedCourses]
  );

  const editingCourse = editingCourseId ? schedule?.courses[editingCourseId] : undefined;
  const formValidationError = getFormValidationError(formValues);
  const hasFormChanges = editingCourse
    ? formValues.term !== editingCourse.term ||
      formValues.number.trim() !== editingCourse.number.trim() ||
      formValues.title.trim() !== editingCourse.title.trim() ||
      formValues.meets.trim() !== editingCourse.meets.trim()
    : editingCourseId === null;

  const unavailableCourseIds = useMemo(() => {
    const ids = new Set<string>();
    const selectedValues = Object.keys(selectedCourseMap).map((key) => selectedCourseMap[key]);

    filteredCourses.forEach((course) => {
      const isSelected = selectedCourses.indexOf(course.id) !== -1;

      if (isSelected) {
        return;
      }

      const conflictsWithSelected = selectedValues.some(
        (selectedCourse) =>
          selectedCourse.id !== course.id && hasConflict(course, selectedCourse)
      );

      if (conflictsWithSelected) {
        ids.add(course.id);
      }
    });

    return ids;
  }, [filteredCourses, selectedCourseMap, selectedCourses]);

  const toggleCourse = (courseId: string) => {
    const course = courseList.find((entry) => entry.id === courseId);

    if (!course) {
      return;
    }

    setSelectedCourses((selected) => {
      const alreadySelected = selected.indexOf(courseId) !== -1;

      if (alreadySelected) {
        return selected.filter((id) => id !== courseId);
      }

      const conflicts = Object.keys(selectedCourseMap).some((selectedCourseId) => {
        const selectedCourse = selectedCourseMap[selectedCourseId];

        return selectedCourse.id !== courseId && hasConflict(course, selectedCourse);
      });

      if (conflicts) {
        return selected;
      }

      return [...selected, courseId];
    });
  };

  const handleFormChange = (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = event.target;

    setFormValues((current) => {
      if (name === 'term') {
        return {
          ...current,
          term: value as Term,
        };
      }

      return {
        ...current,
        [name]: value,
      };
    });
  };

  const openAddForm = () => {
    setEditingCourseId(null);
    setFormValues(defaultFormState);
    setFormError('');
    setShowForm(true);
  };

  const openEditForm = (courseId: string) => {
    const course = schedule?.courses[courseId];

    if (!course) {
      return;
    }

    setEditingCourseId(courseId);
    setFormValues({
      term: course.term as Term,
      number: course.number,
      title: course.title,
      meets: course.meets,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCourseId(null);
    setFormError('');
    setFormValues(defaultFormState);
  };

  const handleSubmitCourse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');

    if (formValidationError) {
      setFormError(formValidationError);
      return;
    }

    if (editingCourseId && !hasFormChanges) {
      return;
    }

    const trimmedNumber = formValues.number.trim();
    const trimmedTitle = formValues.title.trim();
    const trimmedMeets = formValues.meets.trim();

    const nextCourse: Course = {
      term: formValues.term,
      number: trimmedNumber,
      title: trimmedTitle,
      meets: trimmedMeets,
    };

    if (
      schedule &&
      hasDuplicateCourse(schedule.courses, nextCourse, editingCourseId ?? undefined)
    ) {
      setFormError('This course already exists in the schedule.');
      return;
    }

    if (editingCourseId && selectedCourses.indexOf(editingCourseId) !== -1) {
      const selectedConflict = selectedCourseList.some(
        (course) =>
          course.id !== editingCourseId && hasConflict(nextCourse, course)
      );

      if (selectedConflict) {
        setFormError('This change conflicts with another selected course.');
        return;
      }
    }

    const uid = auth.currentUser?.uid;

    if (!uid) {
      setFormError('Please wait for authentication to finish before adding a course.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingCourseId) {
        if (!realtimeDb) {
          throw new Error(
            'Realtime Database is not configured. Set VITE_FIREBASE_DATABASE_URL before editing courses.'
          );
        }

        await set(
          ref(realtimeDb, `users/${uid}/courseEdits/${editingCourseId}`),
          nextCourse
        );

        setSchedule((currentSchedule) => {
          const previousCourses = currentSchedule?.courses ?? {};

          return {
            title: currentSchedule?.title ?? 'Course Schedule',
            courses: {
              ...previousCourses,
              [editingCourseId]: nextCourse,
            },
          };
        });
      } else {
        const docRef = await addDoc(collection(db, 'users', uid, 'courses'), nextCourse);

        setSchedule((currentSchedule) => {
          const previousCourses = currentSchedule?.courses ?? {};

          return {
            title: currentSchedule?.title ?? 'Course Schedule',
            courses: {
              ...previousCourses,
              [docRef.id]: nextCourse,
            },
          };
        });
      }

      closeForm();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The course could not be saved.';

      setFormError(`Could not save the course: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!schedule) {
    return <p className="p-3">Loading...</p>;
  }

  const { title } = schedule;

  return (
    <main className="p-3">
      <h1 className="mb-4 text-3xl font-bold">{title}</h1>

      {(databaseError || authError) && (
        <div
          role="alert"
          className="mb-4 space-y-1 rounded border border-red-300 bg-red-50 p-3 text-red-700"
        >
          {databaseError && <p>{databaseError}</p>}
          {authError && <p>{authError}</p>}
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
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

        <div className="flex gap-2">
          <button
            type="button"
            onClick={openAddForm}
            className="rounded border border-gray-300 bg-white px-4 py-2 hover:bg-gray-100"
          >
            Add Course
          </button>

          <button
            type="button"
            onClick={() => setShowPlan(true)}
            className="rounded border border-gray-300 bg-white px-4 py-2 hover:bg-gray-100"
          >
            Course Plan
          </button>
        </div>
      </div>

      {showForm && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black/40 p-4"
          onClick={closeForm}
        >
          <form
            onSubmit={handleSubmitCourse}
            onClick={(event) => event.stopPropagation()}
            className="w-full max-w-xl rounded-lg border border-gray-300 bg-white p-6 shadow-lg"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">
                {editingCourseId ? 'Edit Course' : 'Add a Course'}
              </h2>

              <button
                type="button"
                onClick={closeForm}
                className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Term
                <select
                  name="term"
                  value={formValues.term}
                  onChange={handleFormChange}
                  className="rounded border border-gray-300 px-3 py-2"
                >
                  {terms.map((term) => (
                    <option key={term} value={term}>
                      {term}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
                Course Number
                <input
                  name="number"
                  value={formValues.number}
                  onChange={handleFormChange}
                  placeholder="e.g. 394"
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
                Course Title
                <input
                  name="title"
                  value={formValues.title}
                  onChange={handleFormChange}
                  placeholder="e.g. Introduction to React"
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 sm:col-span-2">
                Meeting Days and Times
                <input
                  name="meets"
                  value={formValues.meets}
                  onChange={handleFormChange}
                  placeholder="MWF 11:00-11:50"
                  className="rounded border border-gray-300 px-3 py-2"
                />
              </label>
            </div>

            {(formError || formValidationError) && (
              <p className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-700">
                {formError || formValidationError}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeForm}
                className="rounded border border-gray-300 px-4 py-2 hover:bg-gray-100"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  isLoading ||
                  Boolean(formValidationError) ||
                  (editingCourseId !== null && !hasFormChanges)
                }
                className="rounded border border-blue-600 bg-blue-600 px-4 py-2 text-white disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                {isSubmitting
                  ? 'Saving...'
                  : editingCourseId
                    ? 'Submit'
                    : 'Save Course'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {filteredCourses.map(({ id, term, number, meets, title: courseTitle }) => {
          const isSelected = selectedCourses.indexOf(id) !== -1;
          const isUnavailable = unavailableCourseIds.has(id);

          return (
            <article
              key={id}
              className={[
                'flex min-h-40 flex-col rounded-lg border transition-all',
                isSelected
                  ? 'border-blue-600 bg-blue-100 shadow-md ring-2 ring-blue-200'
                  : isUnavailable
                    ? 'cursor-not-allowed border-red-300 bg-red-50 opacity-60'
                    : 'border-gray-300 bg-white hover:bg-gray-50',
              ].join(' ')}
            >
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={isUnavailable && !isSelected}
                onClick={() => toggleCourse(id)}
                className="flex w-full flex-1 flex-col p-4 text-left disabled:cursor-not-allowed"
              >
                <h2 className="text-lg font-medium">
                  {term} CS {number}
                </h2>

                <p className="mt-2">{courseTitle}</p>

                <footer className="mt-auto border-t border-gray-300 pt-3 text-sm">
                  {meets || 'No meeting time'}
                </footer>
              </button>

              <div className="flex justify-end border-t border-gray-300 px-4 py-2">
                <button
                  type="button"
                  onClick={() => openEditForm(id)}
                  className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-white"
                >
                  Edit
                </button>
              </div>
            </article>
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
                  <div key={course.id} className="rounded border border-gray-300 p-3">
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