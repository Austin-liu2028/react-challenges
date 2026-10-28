type Course = {
  term: string;
  meets: string;
};

const getDays = (meets: string): string[] => {
  if (meets === '') {
    return [];
  }

  const dayPart = meets.split(' ')[0];

  return dayPart.match(/M|Tu|W|Th|F/g) || [];
};

const getTimes = (meets: string) => {
  if (meets === '') {
    return null;
  }

  const timePart = meets.split(' ')[1];

  if (!timePart) {
    return null;
  }

  const [start, end] = timePart.split('-');

  return { start, end };
};

const daysOverlap = (meets1: string, meets2: string) => {
  const days1 = getDays(meets1);
  const days2 = getDays(meets2);

  return days1.some((day) => days2.indexOf(day) !== -1);
};

const timeToMinutes = (time: string) => {
  const [hour, minute] = time.split(':').map(Number);

  return hour * 60 + minute;
};

const timesOverlap = (meets1: string, meets2: string) => {
  const times1 = getTimes(meets1);
  const times2 = getTimes(meets2);

  if (!times1 || !times2) {
    return false;
  }

  const start1 = timeToMinutes(times1.start);
  const end1 = timeToMinutes(times1.end);

  const start2 = timeToMinutes(times2.start);
  const end2 = timeToMinutes(times2.end);

  return start1 < end2 && start2 < end1;
};

export const hasConflict = (course1: Course, course2: Course) => {
  if (course1.term !== course2.term) {
    return false;
  }

  if (course1.meets === '' || course2.meets === '') {
    return false;
  }

  return (
    daysOverlap(course1.meets, course2.meets) &&
    timesOverlap(course1.meets, course2.meets)
  );
};