const admin = require('firebase-admin');

const COLLECTION_TASKS = 'tasks';

const getTaksByIdInDate = async (idTask, year) => {
    return await searchTaskInRange(year, idTask);
}

async function searchTaskInRange(year, idTask) {
    let limitDay = 31;
    let limitMonth = 12;
    console.log('task searching: ' + idTask);
    for(let monthIndex = 1; monthIndex <= limitMonth; monthIndex++) {
        let monthSearch = monthIndex.toString();
        monthSearch = monthSearch.length == 1 ? '0' + monthSearch : monthSearch;
        for(let dayIndex = 1; dayIndex <= limitDay; dayIndex++) {
            let day = dayIndex.toString();
            day = day.length == 1 ? '0' + day : day;
            let dateSearch = day + '-' + monthSearch + '-' + year;
            console.log('date searching:' + dateSearch);
            let refTasks = admin.firestore().collection(COLLECTION_TASKS).doc(dateSearch).collection(COLLECTION_TASKS).doc(idTask);
            console.log(refTasks.path);
            let snp = await refTasks.get();
            console.log('data: ' + snp.data());
            if (snp.data() != undefined) {
                return {
                    path: refTasks.path,
                    result: snp.data()
                };
            }
        }
    }
}

// Export functions so they can be used in other files
module.exports = {
    getTaksByIdInDate
};
