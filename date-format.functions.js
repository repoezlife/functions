/**
 * Order Array By date
 * @param {Date} array Array Dates
 * @returns 
 */
const sortByDateDesc = (array) => {
    return array.sort((a, b) => {
      // Convert date "dd-mm-yyyy" to format "yyyy-mm-dd"
      const dateA = a.date.split('-').reverse().join('-');
      const dateB = b.date.split('-').reverse().join('-');
  
      // Convert the strings to Date objects to compare
      return new Date(dateB) - new Date(dateA);
    });
}
 

/**
 * Returns true if dateToEvaluate is beetwen firstDate and lastDate 
 * or false otherwise
 * @param {string} firstDate 
 * @param {string} lastDate 
 * @param {string} dateToEvaluate 
 * @returns 
 */
const evaluateDate = (firstDate, lastDate, dateToEvaluate) => {
    if ((!firstDate && !lastDate)) {
        return true;
    }
    if (!firstDate) {
        return parseDateFormat(dateToEvaluate) <= parseDateFormat(lastDate ?? '');
    }
    if (!lastDate) {
        return parseDateFormat(dateToEvaluate) >= parseDateFormat(firstDate);
    }
    return parseDateFormat(dateToEvaluate) >= parseDateFormat(firstDate) && parseDateFormat(dateToEvaluate) <= parseDateFormat(lastDate);
}

/**
 * Get array date in number format
 * @param {string} date 
 * @returns 
 */
function parseDateFormat(dateString) {
    if(dateString === '') new Date();
    let dateArray = dateString.split('-');
    let resultDate = dateArray[1] + '-' + dateArray[0] + '-' + dateArray[2];
    return new Date(resultDate);
}

// Export functions so they can be used in other files
module.exports = {
    evaluateDate,
    sortByDateDesc
};
