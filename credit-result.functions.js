const calculateCreditsBalance = (docs) => {
    let totalCapitalToPay = 0;
    let totalBalance = 0;
    let numCredits = 0;
    for (let creditdoc of docs) {
        let creditData = creditdoc.data();
        totalCapitalToPay += creditData.capitalToPay;
        totalBalance += creditData.balance;
        numCredits += 1;
    }
    return {
        'capital' : totalCapitalToPay,
        'utility' : totalBalance,
        'numpagos' : numCredits,
    }
}

// Export functions so they can be used in other files
module.exports = {
    calculateCreditsBalance
};
