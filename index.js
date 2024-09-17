const { onRequest } = require("firebase-functions/v2/https");
const { onCall } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const pointInPolygon = require('point-in-polygon');
const fs = require('fs');

/**
 * Init Firestore Admin
 */
const apiKey='AIzaSyDLxCPZqwC3qo61Sv0EsCNKpRf3Oj0IzSk';

const admin = require('firebase-admin');
const { randomInt } = require("crypto");
const { promises } = require("dns");
const { log } = require("console");
const { resolve } = require("path");
const { rejects } = require("assert");
admin.initializeApp();

/**
 * Constants paths for collections Names
 */
const COLLECTION_CREDITS = 'credits';
const COLLECTION_CREDITS_DELETES = 'creditsDeletes';
const COLLECTION_CUSTOMERS = 'customers';
const COLLECTION_MODIFIED_PAYMENTS = 'modifiedPayments';
const COLLECTION_PAYMENT_MEDIUM = 'paymentMedium';
const COLLECTION_PAYMENTS = 'payments';
const COLLECTION_SETTINGS = 'settings';
const COLLECTION_TASKS = 'tasks';
const COLLECTION_USER_LOCATION = 'userLocation';
const COLLECTION_USERS = 'users';
const COLLECTION_VISITS = 'visits';
const COLLECTION_ZONE = 'zone';

/**
 * Constants paths for subcollections Names
 */
const SUBCOLLECTION_SETTINGS_MAXEDITPAYMENTPERIOD = 'maxEditPaymentPeriodDays';
const SUBCOLLECTION_SETTINGS_PRINTERSETTINGS = 'printerSettings';
const SUBCOLLECTION_SETTINGS_SPECIALROUTE = 'specialRoute';
const SUBCOLLECTION_SETTINGS_TRAKINGSCHEDULE = 'trackingSchedule';

// Reg: Today Distribute Functions ---------------------------------------------------------
/**
 * Rest function on request
 * @param string date
 * @return response
 */
exports.todayDistributeTasks = onRequest(async (request, response) => {
    const date = request.query.date;
    console.log("Fecha a distribuir:  " + date);
    await distTasks(date);
    response.status(200).send('Distribución OK');
});

exports.distributeTasks = onSchedule(
    {schedule: 'every day 23:30',
    timeZone: 'America/Bogota', },
     async (event) => {    
    let tomorrow= formatoFecha2();
    console.log("Fecha a distribuir:  "+tomorrow);
    distTasks(tomorrow);
      //  response("Actualización OK");    
});

/**
 * Dist task function
 * @param string date 
 * @returns 
 */
async function distTasks(date) {
    let band=true;
    let band2=true;
    let nCobs=0;
    let nTasks=0;
    const idCobs = [];
    const idTasks = [];
    let factor1=0;
    let factor2=0;
    let residuo=0;
    let idSpRoute="";
    let nCll=0;
    let batch = admin.firestore().batch();  
    const refConfig= admin.firestore().collection("settings").doc("specialRoute");
    const snp= await refConfig.get();

    if (!snp.empty) {
        const x=snp.data();
        idSpRoute=x.idUser;
        nCll=Number(x.collections);    
        if(idSpRoute === null){
            band2=false;
        }    
    }
    console.log("Ruta especial: "+idSpRoute+":  "+nCll);
    const refTasks= admin.firestore().collection("tasks").doc(date).collection("tasks");
    const snapshot = await refTasks.orderBy("zone", "asc").get();
    if (!snapshot.empty) {
        
        snapshot.forEach(doc => {
            const f=doc.data();
            console.log(f.id + " -*- "+f.zone);
            if(f.stateTask === 'pending'){
                idTasks.push(doc.id);
            }            
          });
          nTasks=idTasks.length;
    }
    else{
        console.log('No hay tareas para '+date);
        band=false;
        return;
    }

    if(band){
        const refUsers=admin.firestore().collection("users");
        const cobs=await refUsers.where('role.code', "==","COB").orderBy("cobPosition", "asc").get();
        
        if (!cobs.empty) {
            cobs.forEach(doc => {
                const tt=doc.data();
              if(tt.active == true){
                idCobs.push(doc.id);
            }
                
            });
          //  idCobs.push(idSpRoute);
           // console.log(idCobs);
            nCobs = (idCobs).length;
        } else {
            console.log('No se encontraron documentos con role.code igual a "COB".');
            return;
        }
        if(band2){
            const taskDistribuir=nTasks-nCll;
            let nTareasEq=Math.floor(taskDistribuir / (nCobs-1));
            let nTareasResiduales=taskDistribuir % (nCobs-1);
            let nTareasRutaEspecial=nCll+nTareasResiduales;
            console.log("# Tareas: "+nTasks+"  NCobs: "+nCobs);
            factor1=Math.floor(nTasks / nCobs);
            factor2=factor1*nCobs;
            residuo=nTasks % nCobs;
            let cont=0;
            let u=0;
            let contBatch=0;
            let factorRS=0;
            let contParcialTask=0;

            for(let i=0; i<(nCobs) ;i++){
               
                if(idCobs[i]==idSpRoute){
                    for(u; u<(contParcialTask+nTareasRutaEspecial);u++){
                        const ref=refTasks.doc(idTasks[u]+"");
                        const dataT={
                            idUser:idCobs[i]
                        }
                        batch.update(ref, dataT);
                        contBatch++;
                        console.log(u+". "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i+ "  Esp") ;
                    }
                    factorRS=nTareasRutaEspecial;
                }
                else{
                    cont++; 
                    for(u; u<((cont*nTareasEq)+factorRS);u++){
                        const ref=refTasks.doc(idTasks[u]+"");
                        const dataT={
                            idUser:idCobs[i]
                        }
                        batch.update(ref, dataT);
                        contBatch++;
                        console.log(u+". "+ "  "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i);
                    }
                    contParcialTask=cont*nTareasEq;
             
                    if(contBatch>=500){
                        console.log('Ingreso al IF  cont=== 500');
                            await batch.commit()
                                .then(() => {
                                console.log('Commit del lote exitoso');
                                batch = admin.firestore().batch();
                                contBatch=0;
        
                            })
                            .catch(error => {
                                console.error('Error al hacer el commit del lote:', error);
                            });                
                    } 

                }
         
            } 
            if(contBatch>0){
                console.log('Ingreso al IF  cont > 0');
                        await batch.commit()
                            .then(() => {
                            console.log('Commit del lote exitoso');
                            batch = admin.firestore().batch();
                            contBatch=0;
    
                        })
                        .catch(error => {
                            console.error('Error al hacer el commit del lote:', error);
                        });
            }
            
        }//cierre if band2 (indica que hay ruta especial)
        else{

            const taskDistribuir=nTasks;
            let nTareasEq=Math.floor(taskDistribuir / (nCobs));
            let nTareasResiduales=taskDistribuir % (nCobs);
            //let nTareasRutaEspecial=nCll+nTareasResiduales;
            console.log("# Tareas: "+nTasks+"  NCobs: "+nCobs);
            factor1=Math.floor(nTasks / nCobs);
            factor2=factor1*nCobs;
            residuo=nTasks % nCobs;
            let cont=0;
            let u=0;
            let contBatch=0;
           

            for(let i=0; i<(nCobs) ;i++){        
                     cont++; 
                    if(i==(nCobs-1)){
                        for(u; u<((cont*nTareasEq)+nTareasResiduales);u++){
                            const ref=refTasks.doc(idTasks[u]+"");
                            const dataT={
                                idUser:idCobs[i]
                            }
                            batch.update(ref, dataT);
                            contBatch++;
                            console.log(u+". "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i);
                        }
                    }else{
                        for(u; u<((cont*nTareasEq));u++){
                            const ref=refTasks.doc(idTasks[u]+"");
                            const dataT={
                                idUser:idCobs[i]
                            }
                            batch.update(ref, dataT);
                            contBatch++;
                            console.log(u+". "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i);
                        }

                    }                  
             
                    if(contBatch>=500){
                        console.log('Ingreso al IF  cont=== 500');
                            await batch.commit()
                                .then(() => {
                                console.log('Commit del lote exitoso');
                                batch = admin.firestore().batch();
                                contBatch=0;
        
                            })
                            .catch(error => {
                                console.error('Error al hacer el commit del lote:', error);
                            });                
                    }          
         
            } 
            if(contBatch>0){
                console.log('Ingreso al IF  cont > 0');
                        await batch.commit()
                            .then(() => {
                            console.log('Commit del lote exitoso');
                            batch = admin.firestore().batch();
                            contBatch=0;    
                        })
                        .catch(error => {
                            console.error('Error al hacer el commit del lote:', error);
                        });
            }
        }        
    }//cierre if band (indica que hay tareas q distribuir)    
}

exports.reviewTasks = onSchedule(
    {schedule: 'every day 23:00',
    timeZone: 'America/Bogota', }, 
    async (event) => {
        
    let today= formatoFecha();
    let tomorrow= formatoFecha2();
    const refTasks= admin.firestore().collection("tasks").doc(today+"").collection("tasks");

    let batch = admin.firestore().batch();
    //console.log(refTasks);
    let cont=0;
    const snapshot = await refTasks.get();
    if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }  

    snapshot.forEach(async doc => {
        //console.log(doc.id);
        const data = doc.data();               
        
        if(data.stateTask=="pending"){
            cont=cont+1; 

            const id=data.id+"uS";
            const idC=data.idCredit;
            const tp=data.type;
            const idV=data.idVisit;
            const creditStatus=data.creditStatus || null;
            const valueDisburse=data.valueDisburse || null;

            console.log("Id de tareas pendientes:  "+ data.id+ "  /type: "+tp+"  /Credit: "+ idC+"  /Visit: "+idV);
            

            const dataNewTask={
                id:id,
                date: tomorrow,
                idCredit: data.idCredit,
                address: data.address,
                dateChange: null,
                lat: data.lat,
                lon: data.lon,
                type: data.type,
                idUser: data.idUser,
                phone: data.phone,
                zone:data.zone,
                name: data.name,
                lastName:data.lastName,
                idVisit: data.idVisit,
                stateTask: data.stateTask,
                userWhoModified:null,
                creditStatus:creditStatus,
                valueDisburse:valueDisburse
            }    
            const refNewTask= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks").doc(id);
            batch.set(refNewTask, dataNewTask);

            const dataUpdateTask={                
                dateChange: tomorrow,
                stateTask: "updatedBySystem"                
            } 
            const refTaskToday= admin.firestore().collection("tasks").doc(today).collection("tasks").doc(id);
            batch.update(refTaskToday,dataUpdateTask);

            if(tp == "visit"){
                
                const dataVisit={                
                    schedulingDate: tomorrow
                                    
                } 
                const refUVisit= admin.firestore().collection("visits").doc(idV);
                batch.update(refUVisit, dataVisit);
                console.log("If visit:  " + dataVisit);
                updateVisit(dataVisit,idV );
            }
            else{
                const dataCredit={                
                    nextPay: tomorrow,
                    idTask: id                
                } 
                const refUCredit= admin.firestore().collection("credits").doc(idC);
                batch.update(refUCredit, dataCredit);

                updateCredit(dataCredit, idC);
                
            }
                        
            console.log(dataNewTask);
            console.log(dataUpdateTask);           

      /*       if(cont >= 10){
                console.log('Ingreso al IF  cont=== 10');
                await batch.commit()
                    .then(() => {
                    console.log('Commit del lote exitoso');
                    batch = admin.firestore().batch();
                    cont=0;

                })
                .catch(error => {
                    console.error('Error al hacer el commit del lote:', error);
                });
            }   */

            saveTask(dataNewTask, id, tomorrow);
            updateTask(dataUpdateTask,id, today);
            
            
        }        
      });

/*       if (cont > 0) {
        console.log('Ingreso al IF  > 0');
        await batch.commit()
        .then(() => {
            console.log('Commit del lote exitoso');
            response.status(200).send('Documentos insertados correctamente en Firestore.');
            cont=0;
            batch = admin.firestore().batch();
        })
        .catch(error => {
            console.error('Error al hacer el commit del lote:', error);
        });
    
    } */

  });

// Reg: Payments Events Functions ---------------------------------------------------------
/**
 * On document created (Payment)
 */
exports.createPay = onDocumentCreated("/payments/{idPay}", (event) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const data = snapshot.data();
   
    let dia= formatoFecha();
    let date = data.date; // fecha de abono
    let idCredit = data.idCredit; //id del crédito
    let valuePay = data.valuePay; // Valor del abono
    let valueFee = data.valueFee; // valor cuota
    let numberFee =  data.numberFee; // Número de cuotas
    let type = data.type; // tipo de abono (corrienre, capital, interes, etc)
    let paymentMedium = data.paymentMedium; // Medio de pago efectivo, nequi, 
    let valueCommissionPaymentMedium = data.valueCommissionPaymentMedium;  
    
    let imageReferencePay = data.imageReferencePay; // referencia de donde quedo guardado el recibo
    let userName = data.userName; //  Nombre del usuario que esta realizando el cobro
    let valueCredit = data.valueCredit; // valor del crédito
    let utilityPartial = data.utilityPartial; //  Utilidad parcial del crédito
    let idUser = data.idUser;    
    let idCustomer = data.idCustomer; // id del cliente
    let totalPay = data.totalPay; // Total de pagos del crédito
    let balance = data.balance; // Balance del crédito "resumen"
    let capitalToPay = data.capitalToPay; // Capital por pagar    
    let percentage = data.percentage; // porcentaje del crédito
    let idPay = data.idPay; // Id del pago
    let timeCredit = data.timeCredit; // Tiempo de crédito en días
    let customer = data.customer; // Nombre Cliennte   
    let creditCommissionPaymentMedium = data.creditCommissionPaymentMedium; // Sumatoria de comisiones por pagar
    let commissionToCredit = data.commissionToCredit; // Bandera comisión de pago
    let toDateUntil = data.toDateUntil;
    let extensionDays = data.extensionDays;
    //let refusesToSign = data.refusesToSign;

    console.log(" Abono a crédito:  " + idCredit + "  Con pago de id:    " + idPay);
    console.log(" Llamado Funcióncon Type:  " + type + "  valor CreditCommissionPayMediium:    " + creditCommissionPaymentMedium);
    //console.log("Información que llega del abono /n:   "+data);

    let utilityPart = 0;
    let capitalPart = 0;
    const t = 1;

    // Evalúo si el pago aplica comisión
    if(valueCommissionPaymentMedium != 0 && valueCommissionPaymentMedium != undefined) {
        //evalúo si esta dentro del pago
        if (commissionToCredit) {
            creditCommissionPaymentMedium = creditCommissionPaymentMedium * t;
            const dataCommission = {
                idPay: idPay + "C",
                customer: customer,
                idCustomer: idCustomer,
                valuePay: valueCommissionPaymentMedium,
                capitalPart: 0,
                utilityPart: 0, 
                userName: userName,
                idUser: idUser,
                idCredit: idCredit,
                type: "commissionsPayment",
                paymentMedium: paymentMedium,
                imageReferencePay: imageReferencePay,
                date: date
            }
            registerPayCommission(dataCommission, idPay + "C");
        }
        else{
            creditCommissionPaymentMedium = creditCommissionPaymentMedium + valueCommissionPaymentMedium;
        }
    }
    else{  // en el caso que no aplica comisión

    }

    if(type!="commissionsPayment"){ //verificar type de pago para afectar o no los valores del crédito
        switch(type){
            case "ordinary":
                if(capitalToPay > 0){    

                    if(capitalToPay > valuePay){
                        console.log("capitalToPay menor a valuePay " + valuePay + " < " + capitalToPay);
                        capitalToPay = capitalToPay-valuePay;
                        capitalPart = valuePay;
                        utilityPart = 0;
                    }
                    else{
                        console.log("capitalToPay menor a valuePay " + valuePay + "> " + capitalToPay);
                        capitalPart = capitalToPay;
                        utilityPart = valuePay - capitalPart;

                        console.log("capitalPart " + capitalPart + " utilityPart " + utilityPart);
                        //capitalToPay=capitalToPay-capitalPart;
                        capitalToPay = 0;
                        utilityPartial = utilityPartial + utilityPart;
                    }
                }
                else{
                    console.log("capitalToPay menor a o igual a cero ");
                    utilityPartial = utilityPartial + valuePay;             
                    capitalPart = 0;
                    utilityPart = valuePay;
                }
                balance = balance - valuePay;
                totalPay = totalPay + valuePay;    
                break;    
            case "capital":
                capitalToPay = capitalToPay - valuePay;
                capitalPart = valuePay;
                utilityPart = 0;       
                balance = balance - valuePay;
                totalPay = totalPay + valuePay;    
                break;    
            case "extension":                
                utilityPartial = utilityPartial + valuePay;
                capitalPart = 0;
                utilityPart = valuePay;       
                totalPay = totalPay + valuePay;
                timeCredit = timeCredit + extensionDays;                  
                break;
            case "specialInterest":    
                utilityPartial = utilityPartial + valuePay;
                capitalPart = 0;
                utilityPart = valuePay;       
                totalPay = totalPay;   
                break;
            case "interest":    
                utilityPartial = utilityPartial + valuePay;
                capitalPart = 0;
                utilityPart = valuePay;       
                balance = balance - valuePay;
                totalPay = totalPay + valuePay;
                break;      
        }
      const y = Number(creditCommissionPaymentMedium);
          
        const dataCredit = {
            balance:balance, 
            totalPay:totalPay,
            capitalToPay:capitalToPay,
            utilityPartial:utilityPartial,
            creditCommissionPaymentMedium:y,
            dateLastPay:date,
            creditStatus:"active",
            timeCredit:timeCredit
        }
        if (toDateUntil !== null ) {
            console.log("Ingreso if tDUntil :  " + toDateUntil);
            dataCredit.toDateUntil = toDateUntil;
        }
        const dataPay={
            capitalPart:capitalPart,
            utilityPart:utilityPart
        }

        console.log("Información a actualizar del crédito: "+dataCredit);
        console.log("Información a actualizar del abono: "+dataPay);
      
         updatePay(dataPay, idPay);
         updateCredit(dataCredit, idCredit);
        
    }
    else{
        if(creditCommissionPaymentMedium!=undefined){
            creditCommissionPaymentMedium=creditCommissionPaymentMedium-valuePay;
             const dataCredit={            
                 creditCommissionPaymentMedium:creditCommissionPaymentMedium            
                }
            updateCredit(dataCredit, idCredit);
        }                
    }    
});

/**
 * On Document Deleted (payment)
 */
exports.deletePay = onDocumentDeleted("/payments/{idPay}", (event) => {
    const snap =  event.data;
    const data =  snap.data();
    let type = data.type; // tipo de abono (corrienre, capital, interes, etc)
    let paymentMedium = data.paymentMedium; // Medio de pago efectivo, nequi, 
    let valueCommissionPaymentMedium = data.valueCommissionPaymentMedium;
    
    let idCredit = data.idCredit; //id del crédito
    let utilityPartial = data.utilityPartial; //  Utilidad parcial del crédito
    let totalPay = data.totalPay; // Total de pagos del crédito
    let balance = data.balance; // Balance del crédito "resumen"
    let capitalToPay = data.capitalToPay; // Capital por pagar    
    let creditCommissionPaymentMedium = data.creditCommissionPaymentMedium; // Sumatoria de comisiones por pagar
    let commissionToCredit = data.commissionToCredit; // Bandera comisión de pago
    let toDateUntil = data.toDateUntil;
    let extensionDays = data.extensionDays;
    let timeCredit = data.timeCredit;
    console.log("Eliminar IdPay: " + data.idPay);
    console.log(data);

    //verificar type de pago para afectar o no los valores del crédito
    if (type != "commissionsPayment") {
        const dataCredit = {
            balance: balance, 
            totalPay: totalPay,
            capitalToPay: capitalToPay,
            utilityPartial: utilityPartial
        }
        if(type=="specialInterest"){
            console.log("Ingreso if tDUntil :  " + toDateUntil);
            dataCredit.toDateUntil = null;
        }     
        if(type=="extension"){
            console.log("Ingreso if extensión :  " + toDateUntil);
            dataCredit.timeCredit = timeCredit;
        }
        updateCredit(dataCredit, idCredit);
    }
    else{
        if (creditCommissionPaymentMedium != undefined) {
            const dataCredit = {
                creditCommissionPaymentMedium: creditCommissionPaymentMedium
            }
            updateCredit(dataCredit, idCredit);
        }                
    }
});

/**
 * On Document Updated (payments)
 */
exports.updatePayment = onDocumentUpdated("/payments/{idPay}", (event) => {
    
    const data =event.data.before.data();
    const dataAfter =event.data.after.data();

   // console.log(dia);
    const payBefore=data.valuePay; 
    let valuePay = dataAfter.valuePay; // Valor del abono

    let dia= formatoFecha();
    let date = data.date; // fecha de abono
    let idCredit = data.idCredit; //id del crédito    
    let valueFee = data.valueFee; // valor cuota
    let numberFee =  data.numberFee; // Número de cuotas
    let type =  data.type; // tipo de abono (corrienre, capital, interes, etc)
    let paymentMedium = data.paymentMedium; // Medio de pago efectivo, nequi, 
    let valueCommissionPaymentMedium= data.valueCommissionPaymentMedium;    
    let imageReferencePay = data.imageReferencePay; // referencia de donde quedo guardado el recibo
    let userName=data.userName; //  Nombre del usuario que esta realizando el cobro
    let valueCredit = data.valueCredit; // valor del crédito
    let utilityPartial = data.utilityPartial; //  Utilidad parcial del crédito
    let idUser=data.idUser;    
    let idCustomer = data.idCustomer; // id del cliente
    let totalPay = data.totalPay; // Total de pagos del crédito
    let balance = data.balance; // Balance del crédito "resumen"
    let capitalToPay = data.capitalToPay; // Capital por pagar    
    let percentage = data.percentage; // porcentaje del crédito
    let idPay = data.idPay; // Id del pago
    let timeCredit = data.timeCredit; // Tiempo de crédito en días
    let customer = data.customer; // Nombre Cliennte   
    let creditCommissionPaymentMedium = data.creditCommissionPaymentMedium; // Sumatoria de comisiones por pagar
    let commissionToCredit = data.commissionToCredit; // Bandera comisión de pago
    let toDateUntil = data.toDateUntil;
    let extensionDays = data.extensionDays;
    let utilityPart=0;
    let capitalPart=0;
    const t =1;
    console.log("Nuevo valor:  "+valuePay+"  Valor anterior: "+payBefore);

    if(valuePay != payBefore){    
        console.log("Si hay cambio en el valor del Abono");    

        if(type!="commissionsPayment"){ //verificar type de pago para afectar o no los valores del crédito
            switch(type){
                case "ordinary":
                    if(capitalToPay>0){    
                        if(capitalToPay>valuePay){
                            capitalToPay=capitalToPay-valuePay;
                            capitalPart=valuePay;
                            utilityPart=0;
                        }
                        else{
                            capitalPart=valuePay-capitalToPay;
                            utilityPart=valuePay-capitalPart;
                            capitalToPay=capitalToPay-capitalPart;
                            utilityPartial=utilityPartial+utilityPart;
                        }
                    }
                    else{
                        utilityPartial=utilityPartial+valuePay;             
                        capitalPart=0;
                        utilityPart=valuePay;
                    }
                    balance=balance-valuePay;
                    totalPay=totalPay+valuePay;    
                    break;    
                case "capital":
                    capitalToPay=capitalToPay-valuePay;
                    capitalPart=valuePay;
                    utilityPart=0;       
                    balance=balance-valuePay;
                    totalPay=totalPay+valuePay;    
                    break;    
                case "extension":                
                    utilityPartial=utilityPartial+valuePay;
                    capitalPart=0;
                    utilityPart=valuePay;       
                    totalPay=totalPay+valuePay;
                    timeCredit=timeCredit+extensionDays;                  
                    break;
                case "specialInterest":    
                    utilityPartial=utilityPartial+valuePay;
                    capitalPart=0;
                    utilityPart=valuePay;       
                    totalPay=totalPay+valuePay;   
                    break;
                case "interest":    
                    utilityPartial=utilityPartial+valuePay;
                    capitalPart=0;
                    utilityPart=valuePay;       
                    balance=balance-valuePay;
                    totalPay=totalPay+valuePay;
                    break;      
            }     
            
            const dataCredit={
                balance:balance, 
                totalPay:totalPay,
                capitalToPay:capitalToPay,
                utilityPartial:utilityPartial
            }
            const dataPay={
                capitalPart:capitalPart,
                utilityPart:utilityPart
            }          
            updatePay(dataPay, idPay);      
        
            updateCredit(dataCredit, idCredit);
            
        }
        else{
            if(creditCommissionPaymentMedium!=undefined){
                creditCommissionPaymentMedium=creditCommissionPaymentMedium-valuePay;
                const dataCredit={            
                    creditCommissionPaymentMedium:creditCommissionPaymentMedium            
                    }
                updateCredit(dataCredit, idCredit);
            }                
        }
    }

    else{
        console.log("No hay cambios en el valor del Abono");
        return;
    }
           

});

// Reg: Payments DB Functions ---------------------------------------------------------
/**
 * Update Payments in DB
 * @param dataP 
 * @param idPay 
 */
async function updatePay(dataP, idPay) {
    await admin.firestore().collection(COLLECTION_PAYMENTS).doc(idPay + "").update(dataP).then(() => {
        console.log(idPay + 'Pago actualizado exitosamente. ' + dataP);
    }).catch((error) => {
        console.error(idPay + 'Error al actualizar el pago:', error);
    });
}
/**
 * Register Payment Commision
 * @param dataP 
 * @param idPay 
 */
async function registerPayCommission(dataP, idPay) {
    await admin.firestore().collection(COLLECTION_PAYMENTS).doc(idPay).set(dataP);
    //await admin.firestore().collection('payments').doc(date+"").collection("payments").doc(idPay+"").set(dataP);
}

// Reg: Credits Events Functions ---------------------------------------------------------

exports.sendDataCredit = onRequest(async (request, response) => {
    const idCredit = request.query.idCredit;
    if(idCredit){

        const refCredits = admin.firestore().collection("credits").doc(idCredit);
        const snapshot = await refCredits.get();
        let batch = admin.firestore().batch();
        const hoy = parseFecha(formatoFecha());

        if (snapshot.empty) {
            console.log('No matching documents.');
            return response.status(200).send('No matching documents.');
        }
        const documentos = [];    
        // Iterar sobre los documentos y agregarlos al arreglo
        const ll=snapshot.data();
        
        // Enviar los documentos como respuesta en formato JSON
        response.status(200).send(ll);

    }
    else{
        response.status(200).send('No hay ID');    
    }
    
    
});
exports.reviewDateCredits = onRequest(async (request, response) => {
    try {
        const refCredits = admin.firestore().collection("credits").where("creditStatus", "!=", "finished");
        const snapshot = await refCredits.get();
        let batch = admin.firestore().batch();
        const hoy = parseFecha(formatoFecha());

        if (snapshot.empty) {
            console.log('No matching documents.');
            return response.status(200).send('No matching documents.');
        }
        const overdueCredits = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const nextPay = parseFecha(data.nextPay);
            
            const tomorrow = (formatoFecha2());

            if (nextPay < hoy) {
                overdueCredits.push(data.name +" "+data.lastName+"/"+data.id); // Agregar a la lista de créditos vencidos
                const idTask=data.id+"P";

                if(data.creditStatus == "pending"){
                    const dataNewTask={
                        id:idTask,
                        date: tomorrow,
                        idCredit: data.id,
                        address: data.address,
                        dateChange: null,
                        lat: data.lat,
                        lon: data.lon,
                        type: "creditToDisburse",
                        idUser: "1061706410",
                        phone: data.cellphone,
                        zone:data.zone,
                        name: data.name,
                        lastName:data.lastName,
                        idVisit: null,
                        stateTask: "pending",
                        userWhoModified:null,
                        creditStatus:data.creditStatus,
                        valueDisburse:data.value
                    }    
                    const refNewTask= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks").doc(idTask);
                    batch.set(refNewTask, dataNewTask);
                    const dataCredit={                
                        nextPay: tomorrow,
                        idTask: idTask                
                    } 
                    const refUCredit= admin.firestore().collection("credits").doc(data.id);
                    batch.update(refUCredit, dataCredit);

                }
                else{
                    const dataNewTask={
                        id:idTask,
                        date: tomorrow,
                        idCredit: data.id,
                        address: data.address,
                        dateChange: null,
                        lat: data.lat,
                        lon: data.lon,
                        type: "creditToCollect",
                        idUser: "1061706410",
                        phone: data.cellphone,
                        zone:data.zone,
                        name: data.name,
                        lastName:data.lastName,
                        idVisit: null,
                        stateTask: "pending",
                        userWhoModified:null,
                        creditStatus:data.creditStatus,
                        valueDisburse:null
                    }    
                    const refNewTask= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks").doc(idTask);
                    batch.set(refNewTask, dataNewTask);
                    const dataCredit={                
                        nextPay: tomorrow,
                        idTask: idTask                
                    } 
                    const refUCredit= admin.firestore().collection("credits").doc(data.id);
                    batch.update(refUCredit, dataCredit);
                }          

            }
        });
        await batch.commit().then(() => {
            console.log('Commit del lote exitoso');
            batch = admin.firestore().batch();            
        }).catch(error => {
            console.error('Error al hacer el commit del lote:', error);
        });

        // Enviar todos los créditos vencidos en la respuesta
        if (overdueCredits.length > 0) {
            response.status(200).send(overdueCredits);
        } else {
            response.status(200).send('No hay créditos con fecha de cobro menor a  '+hoy);
        }

    } catch (error) {
        console.error('Error reviewing credits:', error);
        response.status(500).send('Error reviewing credits.');
    }
});

exports.updateStateCredits = onSchedule(
    {schedule: 'every day 05:30', timeZone: 'America/Bogota'},
    async (event) => {
        let wayPay;
        let cont = 0;
        let batch = admin.firestore().batch();
        const refCredits = admin.firestore().collection("credits").where("creditStatus", "!=", "finished");
        const snapshot = await refCredits.get();

        if (snapshot.empty) {
            console.log('No matching documents.');
            return;
        }

        for (const doc of snapshot.docs) {
            const data = doc.data();
            switch(data.wayPay) {
                case "weekly": wayPay = 8; break;
                case "biweekly": wayPay = 15; break;
                case "monthly": wayPay = 30; break;
                default: wayPay = 0; // Default en caso de que `wayPay` sea inesperado
            }
            let dateLastPay;
            let diferenciaDias;
            let condicion=0;           
            const today = parseFecha(formatoFecha());

            if(data.dateLastPay){
                dateLastPay = parseFecha(data.dateLastPay);
                diferenciaDias = Math.ceil(Math.abs(today - dateLastPay) / (1000 * 60 * 60 * 24));
                condicion = diferenciaDias - wayPay;
            }             
            
            const fechaCredito = parseFecha(data.date);
            const diferenciaDias2 = Math.ceil(Math.abs(today - fechaCredito) / (1000 * 60 * 60 * 24));
            const condicion2 = diferenciaDias2 - data.timeCredit;

            console.log(`Credit: ${data.id}, Último pago: ${dateLastPay}, Forma de pago: ${wayPay}, Dif días: ${diferenciaDias}`);
            console.log(`Fecha Crédito: ${fechaCredito}, Tiempo credito: ${data.timeCredit}, Dif días 2: ${diferenciaDias2}`);

            let dataCredit = null;
            if (condicion > 5 && data.creditStatus !== "slowPayer" && data.creditStatus !== "expired") {
                dataCredit = { creditStatus: "slowPayer" };
            } else if (condicion2 >= 1 && data.creditStatus !== "expired") {
                dataCredit = { creditStatus: "expired" };
            }

            if (dataCredit) {
                const refCre = admin.firestore().collection(COLLECTION_CREDITS).doc(data.id);
                const refT = admin.firestore().collection(COLLECTION_TASKS).doc(data.nextPay).collection(COLLECTION_TASKS).doc(data.idTask);
                batch.update(refCre, dataCredit);
                batch.update(refT, dataCredit);
                cont++;
            }

            if (cont >= 200) {
                await batch.commit();
                console.log('Commit del lote exitoso');
                batch = admin.firestore().batch();
                cont = 0;
            }
        }

        if (cont > 0) {
            await batch.commit();
            console.log('Commit del lote final exitoso');
        }
    }
);


exports.updateActiveCreditsForAllCustomers = onSchedule(
    {schedule: 'every day 05:00', timeZone: 'America/Bogota'},
    async (event) => {

    try {
        // Obtener todos los créditos que no están terminados (finished)
        const refCredits = admin.firestore().collection(COLLECTION_CREDITS);
        const snapshotCredits = await refCredits.where("creditStatus", "!=", "finished").get();
    
        // Mapear créditos por cliente
        const creditCountByCustomer = {};
        snapshotCredits.forEach(doc => {
            const data = doc.data();
            const customerId = data.customerId;
            const creditStatus=data.creditStatus;
            if(creditStatus != "pending"){
                if (creditCountByCustomer[customerId]) {
                creditCountByCustomer[customerId]++;
                } else {
                creditCountByCustomer[customerId] = 1;
                 }
            }            
        });
        // Obtener todos los clientes de la colección
        const refCustomers = admin.firestore().collection(COLLECTION_CUSTOMERS);
        const snapshotCustomers = await refCustomers.get();
    
        if (snapshotCustomers.empty) {
            console.log('No customers found.');
            return;
        }
    
        // Crear un batch para actualizar todos los clientes
        let batch = admin.firestore().batch();
        let countBatch = 0;
        let totalUpdated = 0;
    
        snapshotCustomers.forEach(doc => {
            data=doc.data();
            const customerId = doc.id;
            const activeCreditsDb = data.activeCredits;
            const activeCredits = creditCountByCustomer[customerId] || 0; // Si no tiene créditos activos, se asigna 0
            
             if(activeCreditsDb != activeCredits){
                console.log(customerId+" / " +activeCreditsDb +' :'+ activeCredits);
                // Crear objeto de actualización para el cliente
                const dataCustomerUpdate = { activeCredits: activeCredits };
                const refCustomer = refCustomers.doc(customerId);
    

                batch.update(refCustomer, dataCustomerUpdate);
                totalUpdated=totalUpdated+activeCredits;
                countBatch++;

                // Hacer commit cada 400 actualizaciones
                if (countBatch >= 400) {
                    batch.commit().then(() => console.log('Batch commit successful'));
                    batch = admin.firestore().batch();
                    countBatch = 0;
                }
            }
            
        });

        // Hacer commit del último batch si es necesario
        if (countBatch > 0) {
            await batch.commit().then(() => console.log('Final batch commit successful'));
        }

        console.log(totalUpdated);
    } catch (error) {
        console.error('Error updating customers:', error);
        
    }
});

function parseFecha(fechaStr) {
    // Dividir la fecha en partes [día, mes, año]
    const partes = fechaStr.split('-');
    
    // Asegurarse de que las partes tengan exactamente 3 componentes
    if (partes.length !== 3) {
      throw new Error('Formato de fecha inválido');
    }
  
    // Convertir las partes a números (el mes se resta porque los meses en Date son 0-indexados)
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;  // Mes en 0-indexado (0 = enero)
    const anio = parseInt(partes[2], 10);
  
    // Crear el objeto Date
    const fecha = new Date(anio, mes, dia);
  
    return fecha;
  }

// Reg: Credits Auxiliar Functions ---------------------------------------------------------
/**
 * Update Zone to Credits and Tasks
 * @param idCustomer 
 * @param zona 
 * @param activeCredits 
 * @param address 
 * @param lat 
 * @param lon 
 * @returns 
 */
async function updateZoneCreditsTasks(idCustomer, zona, activeCredits, address, lat, lon){
    console.log("Update Credits and task,  " + idCustomer + "  " + zona + "  " + activeCredits);
    
    const refCredits = admin.firestore().collection(COLLECTION_CREDITS);
    const credits = await refCredits.where('customerId', "==", idCustomer).get();
    let batch = admin.firestore().batch();
    let cB = 0;

    if (!credits.empty) {
        //credits.forEach(async doc => {
        for (const doc of credits.docs) {
            const dt = doc.data();
            if (dt.creditStatus != 'finished') {
                
                console.log("UpdateCredit: " + dt.id + "  UpdateTask: " + dt.nextPay + "/" + dt.idTask);

                const dataZone = {
                    zone: zona,
                    address: address,
                    lat: lat,
                    lon: lon
                }
                const refT = admin.firestore().collection(COLLECTION_TASKS).doc(dt.nextPay).collection(COLLECTION_TASKS).doc(dt.idTask);
                const refC = admin.firestore().collection(COLLECTION_CREDITS).doc(dt.id + "");                   
                batch.update(refT, dataZone);
                batch.update(refC, dataZone);
                cB++;
            } else {
                console.log('No se encontraron creditos activos a nombre de ' + idCustomer);
            }            
        }
        if (cB > 0) {
            console.log('Ingreso al IF  cont > 0');
            await batch.commit().then(() => {
                console.log('Commit del lote exitoso');
                batch = admin.firestore().batch();
                cB = 0;
            }).catch(error => {
                console.error('Error al hacer el commit del lote:', error);
            });
        }       
    } else {
        console.log('No se encontraron creditos a nombre de ' + idCustomer);
        return;
    }
}

async function updateCellCreditsTasks(idCustomer, cell, activeCredits){
    console.log("Update Cell in Credits and task,  " + idCustomer + "  " + cell + "  " + activeCredits);
    
    const refCredits = admin.firestore().collection(COLLECTION_CREDITS);
    const credits = await refCredits.where('customerId', "==", idCustomer).get();
    let batch = admin.firestore().batch();
    let cB = 0;

    if (!credits.empty) {
        //credits.forEach(async doc => {
        for (const doc of credits.docs) {
            if (doc.creditStatus != 'finished') {
                const dt = doc.data();
                console.log("UpdateCredit: " + dt.id + "  UpdateTask: " + dt.nextPay + "/" + dt.idTask);

                const dataC = {
                    cellphone: cell
                    
                }
                const dataT = {
                    phone: cell
                    
                }
                const refT = admin.firestore().collection(COLLECTION_TASKS).doc(dt.nextPay).collection(COLLECTION_TASKS).doc(dt.idTask);
                const refC = admin.firestore().collection(COLLECTION_CREDITS).doc(dt.id + "");                   
                batch.update(refT, dataT);
                batch.update(refC, dataC);
                cB++;
            } else {
                console.log('No se encontraron creditos activos a nombre de ' + idCustomer);
            }            
        }
        if (cB > 0) {
            console.log('Ingreso al IF  cont > 0');
            await batch.commit().then(() => {
                console.log('Commit del lote exitoso');
                batch = admin.firestore().batch();
                cB = 0;
            }).catch(error => {
                console.error('Error al hacer el commit del lote:', error);
            });
        }       
    } else {
        console.log('No se encontraron creditos a nombre de ' + idCustomer);
        return;
    }
}

// Reg: Credits DB Function ---------------------------------------------------------
/**
 * Update Credit in DB
 * @param dataCred 
 * @param idCredit 
 */
async function updateCredit(dataCred, idCredit) {
    const creditRef = admin.firestore().collection(COLLECTION_CREDITS).doc(idCredit+"");
    await creditRef.update(dataCred).then(() => {
        console.log(idCredit + '  Credito actualizado exitosamente. ' + dataCred);
    }).catch((error) => {
        console.error(idCredit + '  Error al actualizar el credito:', error);
    });
}

exports.deleteCredits = onDocumentDeleted("/credits/{id}", (event) => {
    
    const snap =  event.data;
    const data =  snap.data();
    console.log(formatoFecha()+":  "+data)
    const refCredits = admin.firestore().collection(COLLECTION_CREDITS_DELETES);
    refCredits.doc(data.id).set(data);
   
});

// Reg: Tasks Events Functions ---------------------------------------------------------

exports.deleteTasksRepeters = onRequest(async (request, response) => {
    try {
        // Obtener todas las tareas desde Firestore
        const mañana=formatoFecha();
        const refTasks = admin.firestore().collection(COLLECTION_TASKS).doc(mañana).collection(COLLECTION_TASKS);
        const snapshot = await refTasks.where("stateTask","==","pending").get();
    
        if (snapshot.empty) {
          console.log('No tasks found.');
          response.status(200).send('No tasks found.');
          return;
        }     
    
        // Mapear tasks agrupadas por idCredit
        const tasksByCredit = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          const idCredit = data.idCredit;
          const typeTask=data.type;

              
            // Asegurarse de que solo procesamos tasks de tipo "creditToCollect"
            if (typeTask === "creditToCollect") {
                if (tasksByCredit[idCredit]) {
                    tasksByCredit[idCredit].push(doc.id); // Guardamos la taskId
                } else {
                    tasksByCredit[idCredit] = [doc.id];
                }
            }
         });
    
        // Identificar y eliminar las duplicadas
        let batch = admin.firestore().batch();
        let countDeleted = 0;
    
        for (const [idCredit, taskIds] of Object.entries(tasksByCredit)) {

          if (taskIds.length > 1) {
            console.log("id del créditp: "+idCredit);

            // Mantener solo una task (la primera) y eliminar las demás           

            const taskToKeep = taskIds[0]; // Puedes cambiar esta lógica si necesitas otra task a mantener
            console.log("tarea a mantener: "+taskToKeep);
            const tasksToDelete = taskIds.slice(1); // Tareas a eliminar (duplicadas)
    
            for (const taskId of tasksToDelete) {
              console.log("Tarea a eliminar: "+taskId);
              const taskRef = refTasks.doc(taskId);
              const creditRef = admin.firestore().collection(COLLECTION_CREDITS).doc(idCredit);
              const dataCredit={
                    idTask:taskToKeep
              };
              batch.update(creditRef,dataCredit);
              batch.delete(taskRef);
              countDeleted++;
            }
    
            // Cometer el batch cada 500 eliminaciones por seguridad
            if (countDeleted >= 200) {
              await batch.commit();
              batch = admin.firestore().batch();
              countDeleted = 0;
            }
          }
        }
    
        // Cometer el último batch si hay eliminaciones pendientes
        if (countDeleted > 0) {
          await batch.commit();
        }
    
        response.status(200).send('Duplicate tasks removed successfully.');
      } catch (error) {
        console.error('Error removing duplicate tasks:', error);
        response.status(500).send('Error removing duplicate tasks.');
      }
});


exports.createTasks = onRequest(async (request, response) => {
    const refCredits = admin.firestore().collection("credits").where("creditStatus", "!=", "finished");
    const snapshot = await refCredits.get();
    if (snapshot.empty) {
        console.log('No matching documents.');
        response.status(200).send('No matching documents.');
        return;
    }

    let batch = admin.firestore().batch();
    let cont = 0;
    const BATCH_LIMIT = 100;

    for (const doc of snapshot.docs) {
        cont += 1;       

        const data = doc.data();
        const idCredit = data.id || '';
        const idTask = data.idTask || '';
        const dateTask = data.nextPay; // Puedes ajustar este valor según sea necesario

        // Validaciones de valores
        if (!idCredit || !idTask || !dateTask) {
            console.error(`Invalid data: idCredit=${idCredit}, idTask=${idTask}, dateTask=${dateTask}`);
            continue; // Salta este ciclo si algún valor es inválido
        }


        const refNewTask = admin.firestore().collection("tasks").doc(dateTask).collection("tasks").doc(idTask);

       // console.log("idCredit: " + idCredit + "  -  idTask: " + idTask);

       //revisar caso estado crédito pending

        const dataNewTask = {
            id: idTask,
            date: data.nextPay,
            idCredit: idCredit,
            idCustomer: data.customerId,
            address: data.address,
            dateChange: null,
            lat: data.lat,
            lon: data.lon,
            type: "creditToCollect",
            idUser: "123123",
            phone: data.cellphone,
            zone: data.zone,
            name: data.name,
            lastName: data.lastName,
            idVisit: null,
            stateTask: "pending",
            userWhoModified: null,
            creditStatus: data.creditStatus
            //
        };
      //  console.log(dataNewTask);

        batch.set(refNewTask, dataNewTask);

        if (cont >= BATCH_LIMIT) {
            console.log('Ingreso al IF  cont === 100');
            await batch.commit().then(() => {
                console.log('Commit del lote exitoso');
                batch = admin.firestore().batch();
                cont = 0;
            }).catch(error => {
                console.error('Error al hacer el commit del lote:', error);
            });
        }
    }

    if (cont > 0) {
        console.log('Ingreso al IF  cont > 0');
        await batch.commit().then(() => {
            console.log('Commit del lote exitoso');
        }).catch(error => {
            console.error('Error al hacer el commit del lote:', error);
        });
    }

    response.status(200).send('Tareas creadas exitosamente.');
});

exports.deletePendingTasks = onRequest(async (request, response) => {
    try {
        // Obtener todas las tareas con estado "pending"
        const refTasks = admin.firestore().collection(COLLECTION_TASKS).doc(formatoFecha()).collection(COLLECTION_TASKS);
        const snapshot = await refTasks.where("stateTask", "==", "pending").get();
    
        if (snapshot.empty) {
            console.log('No pending tasks found.');
            return response.status(200).send('No pending tasks found.');
        }
    
        // Crear un batch para eliminar las tareas
        let batch = admin.firestore().batch();
        let countBatch = 0;
        let totalDeleted = 0;
    
        snapshot.forEach(doc => {
            const taskRef = refTasks.doc(doc.id);
            batch.delete(taskRef); // Eliminar la tarea
            totalDeleted++;
            countBatch++;            
        });
    
        // Hacer commit del último batch si es necesario
        if (countBatch < 15 && countBatch > 0) {
            await batch.commit().then(() => console.log('Final batch commit successful'));
        }    
        response.status(200).send(`Successfully deleted ${totalDeleted} pending tasks.`);
    } catch (error) {
        console.error('Error deleting pending tasks:', error);
        response.status(500).send('Error deleting pending tasks.');
    }
});

// Reg: Tasks DB Functions ---------------------------------------------------------
/**
 * Save Task in DB
 * @param dataT 
 * @param id 
 * @param date 
 */
async function saveTask(dataT, id, date) {
    await admin.firestore().collection(COLLECTION_TASKS).doc(date).collection(COLLECTION_TASKS).doc(id).set(dataT).then(() => {
        console.log('Documento Creado exitosamente. ' + id);
    }).catch((error) => {
        console.error('Error al crear el documento:', error);
    });
    
}

/**
 * Update Task in DB
 * @param dataU 
 * @param id 
 * @param date 
 */
async function updateTask( dataU,id, date) {
    await admin.firestore().collection(COLLECTION_TASKS).doc(date).collection(COLLECTION_TASKS).doc(id).update(dataU).then(() => {
        console.log('Tarea actualizada exitosamente. ' + id);
    }).catch((error) => {
        console.error('Error al actualizar tarea :', error);
    });
}

// Reg: Visit Event Functions ---------------------------------------------------------

exports.updatedVisit = onDocumentUpdated("/visits/{idVisit}", async (event) => {
    console.log('actualizando visita');
    let visitData = event.data.after.data();
    console.log(visitData);
    if(visitData.status == 'done') {
        let visitIncomes = getIncomestoCustomer(visitData);
        let visitExpenses = getExpensestoCustomer(visitData);
        let liquidity = visitIncomes - visitExpenses;

        visitData.totalIncomes = visitIncomes;
        visitData.totalExpenses = visitExpenses;
        visitData.liquidity = liquidity;
        updateVisit(visitData, visitData.idVisit);
    }
});

// Reg: Visit Aux functions ------------------------------------------------------------

function getIncomestoCustomer(visitData) {
    let totalIncomes = 0;
    let result = 0;
    if (visitData.occupation == 'independent') {
        let averageDaysIncome = (visitData.independentGoodDaysIncome + visitData.independentBadDaysIncome) / 2;
        totalIncomes = averageDaysIncome * visitData.independentDaysWorkedInMonth;
        result = (visitData.independentUtilityPercentage / 100) * totalIncomes;
    } else {
        result = visitData.employeeMonthlyIncome + visitData.employeeOtherIncome;
    }
    return result;
}

function getExpensestoCustomer(visitData) {
    let totalExpenses = 0;
    if (visitData.occupation == 'independent') {
        let totalEmployeesPayment = visitData.independentEmployeesAverageSalary * visitData.independentEmployeesAmount;
        totalExpenses = totalEmployeesPayment + 
            visitData.independentWorkPlaceRental + 
            visitData.independentOtherExpenses + 
            visitData.independentBusinessWatter +
            visitData.independentBusinessEnergy +
            visitData.independentBusinessGas +
            visitData.independentBusinessInternet + 
            visitData.watter + 
            visitData.energy + 
            visitData.gas + 
            visitData.internet + 
            visitData.rentOrFee + 
            visitData.feedingExpenses + 
            visitData.gasoline + 
            visitData.cellPhoneExpense + 
            visitData.childSupport + 
            visitData.amusement + 
            visitData.bankDebts + 
            visitData.otherExpenses;
    } else {
        totalExpenses = visitData.watter + 
            visitData.energy + 
            visitData.gas + 
            visitData.internet + 
            visitData.rentOrFee + 
            visitData.feedingExpenses + 
            visitData.gasoline + 
            visitData.cellPhoneExpense + 
            visitData.childSupport + 
            visitData.amusement + 
            visitData.bankDebts + 
            visitData.otherExpenses;
    }
    return totalExpenses;
}

// Reg: Visit DB functions ------------------------------------------------------------
/**
 * Update Visit in DB
 * @param dataVisit 
 * @param idVisit 
 */
async function updateVisit(dataVisit, idVisit) {
    const visitRef = admin.firestore().collection(COLLECTION_VISITS).doc(idVisit + "");
    await visitRef.update(dataVisit).then(() => {
        console.log(idVisit + '  Visita actualizado exitosamente. ' + dataVisit);
    }).catch((error) => {
        console.error(idVisit+ '  Error al actualizar el credito:', error);
    });
}


// Reg: get Zone functions (Created Customer) ---------------------------------------------------------
/**
 * Start with create customer
 */
exports.getZone = onDocumentCreated("/customers/{id}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const customer = snapshot.data();
    getZoneByCustomer(customer).then(zoneCustomer => {
        customer.zone = zoneCustomer;
        saveCustomer(customer);
    });
});

/**
 * Save Customer in database 
 * @param {any} customer element customer of database
 */
async function saveCustomer(customer) {
    try {
        console.log('actualizando cliente...' + customer.id + ' :: ' + customer.zone);
        return await admin.firestore().collection(COLLECTION_CUSTOMERS).doc(customer.id).set(customer);
    } catch (err) {
        console.log('el error con ci:' + customer.id);
        console.log(err);
    }
}

// Reg: Update Zone for Customers functions ---------------------------------------------------------
/**
 * Update zones for all customers
 */
exports.updateZoneForCustomers = onRequest(async (request, response) => {
    try {
        let responseMessage = '';
        //Get Map Polygon from Zones
        const refZones = admin.firestore().collection(COLLECTION_ZONE);
        const zonesSnapshot = await refZones.get();
        if (zonesSnapshot.empty) {
            let responseMessage = 'No matching documents in Zones.';
            console.log(responseMessage);
            response.status(200).send(responseMessage);
        }
        let zones = [];
        zonesSnapshot.forEach(zoneData => {
            zones.push(zoneData.data());
        });
        polygonZones = getPolygonMapByZones(zones);
        //Get All Customer
        const refCustomers = admin.firestore().collection(COLLECTION_CUSTOMERS);
        const customerSnapshot = await refCustomers.get();
        if (customerSnapshot.empty) {
            responseMessage = 'No matching documents in Customers.';
            response.status(200).send(responseMessage);
        }
        let customers = [];
        customerSnapshot.forEach(customerData => {
            customers.push(customerData.data());
        });
        //Update Zones
        customers.map(customer => {
            updateZoneForCustomer(customer, polygonZones);
        });
        saveMultipleCustomer(customers);
        responseMessage = 'Clientes actualizando correctamente';
        response.status(200).send(responseMessage);
    } catch (e) {
        console.log('Error: ', e);
    }
});

/**
 * Update Zone for Customer object data
 * @param customer Customer Data Object
 * @param polygonZones Array With Polygon Zones
 * @returns customer
 */
function updateZoneForCustomer(customer, polygonZones) {
    for (var i = 0; i < polygonZones.length; i++) {
        if(verifyZone([customer.address.address1.lat, customer.address.address1.lon], polygonZones[i].points)) {
            customer.zone = polygonZones[i].zonePosition;
            return customer;
        }
    }
    customer.zone = -1;
    return customer;
}

// Reg: Customer Events functions ---------------------------------------------------------
/**
 * On Document Updated (customers)
 */
exports.updateCustomer = onDocumentUpdated("/customers/{id}", async (event) => {
    console.log('actualizando customer');
    const customerData =event.data.after.data();
    const customerDataBf =event.data.before.data();
    
    if (customerData.address.address1.lat != customerDataBf.address.address1.lat 
        || customerData.address.address1.lon != customerDataBf.address.address1.lon 
         || customerData.zone != customerDataBf.zone) {
        getZoneByCustomer(customerData).then(zoneCustomer => {
            console.log('Zona del customer:' + customerData.id + '::' + zoneCustomer);
            customerData.zone = zoneCustomer;
            saveCustomer(customerData).then(() => {
                updateZoneCreditsTasks(customerData.id, customerData.zone, customerData.activeCredits,
                 customerData.address.address1.address, customerData.address.address1.lat, customerData.address.address1.lon);
            });
        });
    }
    if(customerData.cell.cell1 != customerDataBf.cell.cell1)
        {
            updateCellCreditsTasks(customerData.id, customerData.cell.cell1, customerData.activeCredits);
        }
});
/**
 * Save Multiple Customers
 * @param customerList Array of customers
 */
async function saveMultipleCustomer(customerList) {
    const pomises = [];
    customerList.forEach(customer => {
        pomises.push(saveCustomer(customer));
    });
    const dataloaded = await Promise.all(pomises);
}
//

/**
 * Print Customers on Request
 */
exports.printCustomers = onRequest(async (request, response) => {
    const customers = admin.firestore().collection("customers");
    try {
        const querySnapshot = await customers.get();
        const documentos = [];
    
        // Iterar sobre los documentos y agregarlos al arreglo
        querySnapshot.forEach(doc => {
          documentos.push(doc.data());
        });
    
        // Enviar los documentos como respuesta en formato JSON
        response.status(200).send(documentos);
      } catch (error) {
        console.error('Error al obtener documentos:', error);
        response.status(500).send('Error al obtener documentos');
      }
});

// Reg: Zones Events Functions ---------------------------------------------------------
exports.updateZoneInCreditsAndTasks = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('updateZones.json', 'utf8');
        const data = JSON.parse(jsonData);
        //console.log(data);
        const zoneCustomers = Object.values(data);        


        // Obtener una referencia a la colección en Firestore donde deseas insertar los documentos
        const refCredits = admin.firestore().collection(COLLECTION_CREDITS);
        
        // Procesar los documentos y agregarlos a la colección
        let batch = admin.firestore().batch();
        const batchSize = 20; // Tamaño máximo de lote
        const maxBatches = 300; // Límite máximo de lotes a insertar
        let batchesInserted = 0; // Contador de lotes insertados
       
        let cB = 0;

        console.log("Tamaño Json: " + zoneCustomers.length); //  registros
        
        for (const doc of zoneCustomers) { 

            const credits = await refCredits.where('customerId', "==", doc.document).get();
            const newZone = doc.zone;
            const newAdress = doc.address;
            const newLat = doc.lat;
            const newLon = doc.lon;

            if (!credits.empty) {
                for (const dc of credits.docs) {
                    const dt = dc.data();
                    if(dt.creditStatus != 'finished'){
                        console.log("UpdateCredit: " + dt.id + "  UpdateTask: " + dt.nextPay + "/" + dt.idTask);        
                        const dataZone={
                            zone: newZone,
                            address: newAdress,
                            lat: newLat,
                            lon: newLon
                        }
                        const refT = admin.firestore().collection(COLLECTION_TASKS).doc(dt.nextPay).collection(COLLECTION_TASKS).doc(dt.idTask);
                        const refC = admin.firestore().collection(COLLECTION_CREDITS).doc(dt.id);                   
                        batch.update(refT, dataZone);
                        batch.update(refC, dataZone);
                        cB++;                        
                    } else {
                        console.log('No se encontraron creditos activos a nombre de '+doc.document);
                    }            
                }
                if (cB>200) {
                    console.log('Ingreso al IF  cont > 200');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        cB=0;        
                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                }       
            } else {
                console.log('No se encontraron creditos a nombre de '+doc.document);                
            }                     
        }

        if (cB > 0) {
            console.log('Ingreso al IF  > 0');
            await batch.commit().then(() => {
                console.log('Commit del lote exitoso');
                response.status(200).send('Documentos insertados correctamente en Firestore.');
                cB=0;
                batch = admin.firestore().batch();
            }).catch(error => {
                console.error('Error al hacer el commit del lote:', error);
            });
        }
    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
        response.status(500).send('Error al leer el archivo JSON.');
    }
});



// Reg: Auxiliar Functions ---------------------------------------------------------
/**
 * Parce string date to Date Object
 * @param fechaString 
 * @returns Date
 */
function parseFecha(fechaString) {
    const partes = fechaString.split('-');
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const anio = parseInt(partes[2], 10);

    return new Date(anio, mes, dia);
}
/**
 * Get Current Date in string format
 * @returns formatoFechaModificado
 */
function formatoFecha() {
    const fecha = new Date();
    const zonaHoraria = 'America/Bogota';
    const opciones = {
    timeZone: zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
    };    
    const formatoFecha= new Intl.DateTimeFormat('en-ES', opciones).format(fecha);
    const [mes, dia, anio] = formatoFecha.split('/');
    const formatoFechaModificado = `${dia}-${mes}-${anio}`;   
    return formatoFechaModificado;
}

/**
 * Get Date Tomorrow in string format
 * @returns formatoFechaModificado 
 */
function formatoFecha2() {
    const fecha = new Date();
    const zonaHoraria = 'America/Bogota';
    const opciones = {
    timeZone: zonaHoraria,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
    };    
    const formatoFecha= new Intl.DateTimeFormat('en-ES', opciones).format(fecha);
    const nuevaFecha = new Date(formatoFecha);
    nuevaFecha.setDate(nuevaFecha.getDate() + 1);

    const dia = nuevaFecha.getDate().toString().padStart(2, '0');
    const mes = (nuevaFecha.getMonth() + 1).toString().padStart(2, '0');
    const anio = nuevaFecha.getFullYear();

    const formatoFechaModificado = `${dia}-${mes}-${anio}`;   
    return formatoFechaModificado;
}

/**
 * Get date format 3
 * @returns string date
 */
function formatoFecha3() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Return zones data
 */
const getZonesData = new Promise((resolve, reject) => {
    console.log('buscando zonas...');
    const refZones = admin.firestore().collection(COLLECTION_ZONE);
    refZones.get().then(zonesSnapshot => {
        if (zonesSnapshot.empty) {
            let responseMessage = 'No matching documents in Zones.';
           // console.log(responseMessage);
        }
        let zones = [];
        zonesSnapshot.forEach(zoneData => {
            zones.push(zoneData.data());
        });
      //  console.log(zones);
        resolve(zones);
    });
});

/**
 * Get Zone By customer
 * @param customer Customer Object Data
 */
function getZoneByCustomer(customer) {
    return new Promise((resolve, reject) => {
        getZonesData.then(zones => {
            polygonZones = getPolygonMapByZones(zones);
            zone = -1;
            for (var i = 0; i < polygonZones.length; i++) {
                if(verifyZone([customer.address.address1.lat, customer.address.address1.lon], polygonZones[i].points)) {
                    zone = polygonZones[i].zonePosition;
                    break;
                }
            }
            resolve(zone);
        });
    });
}

/**
 * Verify Zone for Customer
 * @param customerCoords array [lat, lon]
 * @param zonePolygon array [[lat, lon],[...],...]
 */
function verifyZone(customerCoords, zonePolygon) {
    return pointInPolygon(customerCoords, zonePolygon);
}

/**
 * Get Polygon Map By Zone or all Zones
 * @param {Array} zones array of zones
 * @return {Array} return array of polygon zones
 */
function getPolygonMapByZones(zones) {
    let result = [];
    if(zones.length == 0) {
        return result;
    }
    result = zones.map(zone => {
        return {
            zonePosition : zone.position,
            points : zone.polygon.map(polygonPoint => [polygonPoint.lat, polygonPoint.lng])
        };
    });
    return result;
}
