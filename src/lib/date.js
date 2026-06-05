export const toLocalDateString = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getCurrentMonth = (date = new Date()) => toLocalDateString(date).slice(0, 7);

export const getDueDateForMonth = (month) => `${month}-10`;
