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
    if (parseDateFormat(dateToEvaluate) >= parseDateFormat(firstDate) && parseDateFormat(dateToEvaluate) <= parseDateFormat(lastDate)) {
        console.log(parseDateFormat(firstDate), parseDateFormat(lastDate));
        console.log(parseDateFormat(dateToEvaluate));
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
    evaluateDate
};
