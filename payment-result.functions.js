const calculateMonthBalance = (docs, dateMonthFilter) => {
    let totalCapital = 0;
    let totalUtility = 0;
    let numPagos = 0;
    for (let paydoc of docs) {
        let payData = paydoc.data();
        if (payData.date.include(dateMonthFilter)) {
            totalCapital += payData.capitalPart;
            totalUtility += payData.utilityPart;
            numPagos += 1;
        }
    }
    return {
        'capital' : totalCapital,
        'utility' : totalUtility,
        'numpagos' : numPagos,
    }
}
// Export functions so they can be used in other files
module.exports = {
    calculateMonthBalance
};
