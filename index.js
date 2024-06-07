

const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
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
admin.initializeApp();

/**
 * Constants paths for collections Names
 */
const CUSTOMERS_COLLECTION_NAME = 'customers';
const ZONE_COLLECTION_NAME = 'zone';

/**
 * Crear Zona para un Cliente
 * 
 */

exports.getZone = onDocumentCreated("/customers/{id}", async (event) => {
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const customer = snapshot.data();
    const refZones = admin.firestore().collection(ZONE_COLLECTION_NAME);
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
    updateZoneForCustomer(customer, polygonZones);
});

/**
 * Update zones for all customers
 * 
 */

exports.updateZoneForCustomers = onRequest(async (request, response) => {
    try {
        let responseMessage = '';
        //Get Map Polygon from Zones
        const refZones = admin.firestore().collection(ZONE_COLLECTION_NAME);
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
        const refCustomers = admin.firestore().collection(CUSTOMERS_COLLECTION_NAME);
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
 * Update Zone for Customer
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

/**
 * 
 */
async function saveMultipleCustomer(customerList) {
    const pomises = [];
    customerList.forEach(customer => {
        pomises.push(saveCustomer(customer));
    });
    const dataloaded = await Promise.all(pomises);
}

/**
 * Save Customer in database 
 * @param {any} customer element customer of database
 */
async function saveCustomer(customer) {
    try {
        console.log('actualizando cliente...' + customer.id + ' :: ' + customer.zone);
        return await admin.firestore().collection(CUSTOMERS_COLLECTION_NAME).doc(customer.id).set(customer);
    } catch (err) {
        console.log('el error con ci:' + customer.id);
        console.log(err);
    }
}

/**
 * Verify Zone for Customer
 * @param {array} customerCoords array [lat, lon]
 * @param {array} zonePolygon array [[lat, lon],[...],...]
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
exports.distributeTasks = onSchedule("every day 23:30", async (event) => {
    let band=true;
    let nCobs=0;
    let nTasks=0;
    const idCobs = [];
    const idTasks = [];
    let factor1=0;
    let factor2=0;
    let residuo=0;
    let batch = admin.firestore().batch();
    let tomorrow= formatoFecha2();
    const refTasks= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks");
    const snapshot = await refTasks.orderBy("zone", "asc").get();
    if (!snapshot.empty) {
        snapshot.forEach(doc => {
            idTasks.push(doc.id);
          });
          nTasks=idTasks.length;
    }
    else{
        console.log('No hay tareas para '+tomorrow);
        band=false;
    }
    if(band){
        const refUsers=admin.firestore().collection("users");
        const cobs=await refUsers.where('role.code', "==","COB").get();
        
        if (!cobs.empty) {
            cobs.forEach(doc => {
                idCobs.push(doc.id);
            });
            nCobs = (idCobs).length;
        } else {
            console.log('No se encontraron documentos con role.code igual a "COB".');
            return;
        }
        factor1=Math.floor(nTasks / nCobs);
        factor2=factor1*nCobs;
        residuo=nTasks % nCobs;
        let cont=0;
        let u=0;
        let contBatch=0;
        for(let i=0; i<nCobs ;i++){
            cont++;            
            for(u; u<(cont*factor1);u++){
                const ref=refTasks.doc(idTasks[u]+"");
                const dataT={
                    idUser:idCobs[i]
                }
                batch.update(ref, dataT);
                contBatch++;
            }
            u++;
            if(i== (nCobs-1) && residuo>0){
                for(u; u<nTasks;u++){
                    const ref=refTasks.doc(idTasks[u]+"");
                    const dataT={
                        idUser:idCobs[i]
                    }
                    batch.update(ref, dataT);
                    contBatch++;
                }                
            }
            if(contBatch>=100){
                console.log('Ingreso al IF  cont=== 100');
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
            console.log('Ingreso al IF  cont=== 70');
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
});
exports.httpDistributeTasks = onRequest(async (request, response) => {
    let band=true;
    let nCobs=0;
    let nTasks=0;
    const idCobs = [];
    const idTasks = [];
    let factor1=0;
    let factor2=0;
    let residuo=0;
    let batch = admin.firestore().batch();
    let tomorrow= formatoFecha2();
    const refTasks= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks");
    const snapshot = await refTasks.orderBy("zone", "asc").get();
    if (!snapshot.empty) {
        snapshot.forEach(doc => {
            idTasks.push(doc.id);
          });
          nTasks=idTasks.length;
    }
    else{
        console.log('No hay tareas para '+tomorrow);
        band=false;
    }
    if(band){
        const refUsers=admin.firestore().collection("users");
        const cobs=await refUsers.where('role.code', "==","COB").get();
        
        if (!cobs.empty) {
            cobs.forEach(doc => {
                idCobs.push(doc.id);
            });
            nCobs = (idCobs).length;
        } else {
            console.log('No se encontraron documentos con role.code igual a "COB".');
            return;
        }
        factor1=Math.floor(nTasks / nCobs);
        factor2=factor1*nCobs;
        residuo=nTasks % nCobs;
        let cont=0;
        let u=0;
        let contBatch=0;
        for(let i=0; i<nCobs ;i++){
            cont++;            
            for(u; u<(cont*factor1);u++){
                const ref=refTasks.doc(idTasks[u]+"");
                const dataT={
                    idUser:idCobs[i]
                }
                batch.update(ref, dataT);
                contBatch++;
            }
            u++;
            if(i== (nCobs-1) && residuo>0){
                for(u; u<nTasks;u++){
                    const ref=refTasks.doc(idTasks[u]+"");
                    const dataT={
                        idUser:idCobs[i]
                    }
                    batch.update(ref, dataT);
                    contBatch++;
                }                
            }
            if(contBatch>=100){
                console.log('Ingreso al IF  cont=== 100');
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
            console.log('Ingreso al IF  cont=== 70');
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
});

exports.reviewTasks = onSchedule("every day 23:00", async (event) => {
    let today= formatoFecha();
    let tomorrow= formatoFecha2();
    const refTasks= admin.firestore().collection("tasks").doc(today+"").collection("tasks");
    //console.log(refTasks);
    const snapshot = await refTasks.get();
    if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }        
      snapshot.forEach(doc => {
        //console.log(doc.id);
        const data = doc.data();        
        
        if(data.stateTask=="pending"){
            console.log("Id de tareas pendientes:  "+ data.id);
            const id=data.id;
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
                idVisit: data.idVisit,
                stateTask: data.stateTask                   
            }    
            const dataUpdateTask={                
                dateChange: tomorrow,
                stateTask: "updatedBySystem"                
            } 
            const dataCredit={                
                nextPay: tomorrow,
                idTask: id                
            } 

            saveTask(dataNewTask, id, tomorrow);
            updateTask(dataUpdateTask,id, today);
            updateCredit(dataCredit, data.idCredit);
            
        }        
      });
  });

  async function saveTask(dataT, id, date) {
    await admin.firestore().collection('tasks').doc(date).collection("tasks").doc(id).set(dataT).then(() => {
        console.log('Documento Creado exitosamente. ' + idN);
      })
      .catch((error) => {
        console.error('Error al crear el documento:', error);
      });
    
  }
  async function updateTask( dataU,id, date) {
    await admin.firestore().collection('tasks').doc(date).collection("tasks").doc(id).update(dataU).then(() => {
        console.log('Documento actualizado exitosamente. ' + id);
      })
      .catch((error) => {
        console.error('Error al actualizar el documento:', error);
      });
  }

exports.createPay = onDocumentCreated("/payments/{idPay}", (event) => {
    // Get an object representing the document
    // e.g. {'name': 'Marie', 'age': 66}
    const snapshot = event.data;
    if (!snapshot) {
        console.log("No data associated with the event");
        return;
    }
    const data = snapshot.data();

   // console.log(dia);
   let dia= formatoFecha();
    let date = data.date; // fecha de abono
    let idCredit = data.idCredit; //id del crédito
    let valuePay = data.valuePay; // Valor del abono
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
//    let refusesToSign=data.refusesToSign;

console.log(" Llamado Funcióncon Type:  "+type +"  valor CreditCommissionPayMediium:    "+creditCommissionPaymentMedium);

    let utilityPart=0;
    let capitalPart=0;
    const t =1;

    if(valueCommissionPaymentMedium!=0 && valueCommissionPaymentMedium!=undefined ){ // Evalúo si el pago aplica comisión
        if(commissionToCredit){         //evalúo si esta dentro del pago
            creditCommissionPaymentMedium=creditCommissionPaymentMedium*t;
            const dataCommission={
                idPay:idPay+"C",
                customer: customer,
                idCustomer: idCustomer,
                valuePay: valueCommissionPaymentMedium,
                capitalPart:0,
                utilityPart: 0, 
                userName:userName,
                idUser:idUser,
                idCredit:idCredit,
                type:"commissionsPayment",
                paymentMedium: paymentMedium,
                imageReferencePay:imageReferencePay,
                date:date
            }
            registerPayCommission(dataCommission, idPay+"C");
        }
        else{
            creditCommissionPaymentMedium=creditCommissionPaymentMedium+valueCommissionPaymentMedium;
        }
    }
    else{  // en el caso que no aplica comisión

    }

    if(type!="commissionsPayment"){ //verificar type de pago para afectar o no los valores del crédito
        switch(type){
            case "ordinary":
                if(capitalToPay>0){    

                    if(capitalToPay>valuePay){
                        console.log("capitalToPay menor a valuePay "+valuePay +" < "+capitalToPay);
                        capitalToPay=capitalToPay-valuePay;
                        capitalPart=valuePay;
                        utilityPart=0;
                    }
                    else{
                        console.log("capitalToPay menor a valuePay "+valuePay +"> "+capitalToPay);
                        capitalPart=capitalToPay;
                        utilityPart=valuePay-capitalPart;

                        console.log("capitalPart "+capitalPart +" utilityPart "+utilityPart);
                        //capitalToPay=capitalToPay-capitalPart;
                        capitalToPay=0;
                        utilityPartial=utilityPartial+utilityPart;
                    }
                }
                else{
                    console.log("capitalToPay menor a o igual a cero ");
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
      const y=Number(creditCommissionPaymentMedium);
          
        const dataCredit={
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
            console.log("Ingreso if tDUntil :  "+toDateUntil);
            dataCredit.toDateUntil = toDateUntil;
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
});
  
  async function updatePay(dataP, idPay) {
    await admin.firestore().collection('payments').doc(idPay+"").update(dataP);
   }

  async function updateCredit(dataCred, idCredit) {
    const creditRef = admin.firestore().collection("credits").doc(idCredit+"");
    await creditRef.update(dataCred).then(() => {
        console.log('Documento actualizado exitosamente. ' + idCredit);
      })
      .catch((error) => {
        console.error('Error al actualizar el documento:', error);
      });
  }
  async function registerPayCommission(dataP, idPay) {
    await admin.firestore().collection('payments').doc(idPay).set(dataP);
 //   await admin.firestore().collection('payments').doc(date+"").collection("payments").doc(idPay+"").set(dataP);
  }

  exports.updateStateCredits = onSchedule("every monday 05:00", async (event) => {
    let wayPay;
    const refCredits= admin.firestore().collection("credits").where("creditStatus", "!=", "finished");
    const snapshot = await refCredits.get();
    if (snapshot.empty) {
        console.log('No matching documents.');
        return;
      }        
      snapshot.forEach(doc => {
        const data=doc.data();
        switch(data.wayPay){
            case "weekly":
               wayPay=8; 
            break;
            case "biweekly":
               wayPay=15; 
            break;
            case "monthly":
               wayPay=30; 
            break;
        }
        const dateLastPay = new Date(data.dateLastPay);
        const today =new Date(formatoFecha());
        const diferencia=Math.abs(today-dateLastPay);
        const diferenciaDias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
        const condicion=diferenciaDias-wayPay;

        const fechaCredito=new Date(data.date);
        const diferencia2=Math.abs(today-fechaCredito);
        const diferenciaDias2 = Math.ceil(diferencia2 / (1000 * 60 * 60 * 24));
        const condicion2=diferencia2-data.timeCredit;

        
        if(condicion > 5 && data.creditStatus!="slowPayer" && data.creditStatus!="expired"){
            const dataCredit={
                creditStatus:"slowPayer"
            }
            updateCredit(dataCredit, data.idCredit);
                        
        }
        else if(condicion2>=1 && data.creditStatus!="expired"){
            const dataCredit={
                creditStatus:"expired"
            }
            updateCredit(dataCredit, data.idCredit);
        }

      });  
  
});


exports.deletePay = onDocumentDeleted("/payments/{idPay}", (event) => {

    const snap =  event.data;
    const data =  snap.data();
    let type =  data.type; // tipo de abono (corrienre, capital, interes, etc)
    let paymentMedium = data.paymentMedium; // Medio de pago efectivo, nequi, 
    let valueCommissionPaymentMedium= data.valueCommissionPaymentMedium;
    
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

    if(type!="commissionsPayment"){ //verificar type de pago para afectar o no los valores del crédito
          
        const dataCredit={
            balance:balance, 
            totalPay:totalPay,
            capitalToPay:capitalToPay,
            utilityPartial:utilityPartial
        }
        if(type=="specialInterest"){
            console.log("Ingreso if tDUntil :  "+toDateUntil);
            dataCredit.toDateUntil = null;
        }     
        if(type=="extension"){
            console.log("Ingreso if extensión :  "+toDateUntil);
            dataCredit.timeCredit = timeCredit;
        }
      
         updateCredit(dataCredit, idCredit);
        
    }
    else{
        if(creditCommissionPaymentMedium!=undefined){
            
             const dataCredit={            
                 creditCommissionPaymentMedium:creditCommissionPaymentMedium            
                }
            updateCredit(dataCredit, idCredit);
        }                
    }





});


exports.updatePay = onDocumentUpdated("/payments/{idPay}", (event) => {
    
    const data =event.data.before.data();
    const dataBefore =event.data.after.data();

   // console.log(dia);
    let valuePay = dataBefore.valuePay; // Valor del abono
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

    console.log("Update Valor de abono:  "+valuePay);



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



exports.insertCustomers = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('customers3.json', 'utf8');
        const data = JSON.parse(jsonData);
     //   console.log(data);
     const customerValues = Object.values(data);

        // Obtener una referencia a la colección en Firestore donde deseas insertar los documentos
        const collectionRef = admin.firestore().collection('customers');

        // Procesar los documentos y agregarlos a la colección
        let batch = admin.firestore().batch();
        const batchSize = 20; // Tamaño máximo de lote
        const maxBatches = 300; // Límite máximo de lotes a insertar
        let batchesInserted = 0; // Contador de lotes insertados
        let cont = 0;
        let cont2 = 0;

        console.log("Tamaño Json: "+ customerValues.length); // 1920 rergistros
        for (const doc of customerValues) {
            cont=cont+1;
            cont2=cont2+1;
                                  
          //  if(doc.comportamientoCredito === "Renovable"){ //433 soN No  Renovables
                const idid= doc.id || "A_"+Math.floor(Math.random() * 100) + 1;
                const ide=idid+"";
                const cell=doc.cell+"";
                
                const docRef = collectionRef.doc(ide); // 
                const reference = doc.reference || " ";
                let maxCupo= doc.maxCupo || "15";
                const addrss= await funAdrress(doc.address2);
                const addrss2= doc.addressHouse || null;
                maxCupo=Number(maxCupo);
                console.log(cont2 +".  "+ide );

                const restructuredData = {
                    id: doc.id,
                    address:{
                        address1:{
                            address:addrss[0]+", "+addrss[3]+", "+addrss[4],
                            lat:(+addrss[1]*1),
                            lon:(+addrss[2]*1),
                            neighborhood:addrss[3],
                            freeReference:addrss[4]
                        },
                        address2:{
                            address:addrss2,
                            lat:null,
                            lon:null,
                            neighborhood:null,
                            freeReference:null
                        }
                    },
                    behavior: "renewable",
                    birthday:null,
                    cell:{
                        cell1:cell,
                        cell2:null
                    },
                    document:doc.id,
                    documentType:"CC",
                    email:null,
                    name:{
                        lastName:doc.lastName,
                        name:doc.name
                    },
                    creditTime:{
                        initial:30,
                        intermediate:60,
                        maximum:180,
                        state:2
                    },
                    quotas:{
                        initial:0,
                        intermediate:0,
                        maximum:maxCupo,
                        state:2
                    },
                    reference:reference,
                    state:"accepted",
                    refuseReason:null,
                    visitApply:false,
                    zone:null,
                    date:"01-01-2000",
                    lastFinishedCreditDate:null,
                    activeCredits:0
                };
                batch.set(docRef, restructuredData);
               
                if(cont >= 70){
                    console.log('Ingreso al IF  cont=== 70');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        cont=0;

                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                }

                /* if (batch.size >= 9) {
                    console.log('Ingreso al IF  >= 9');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        batchesInserted++;

                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                } */
           // }
            
        }

//        console.log("Tamaño batch  "+batch.operations.size);

        if (cont > 0) {

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
        
        }
       
        
    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
        response.status(500).send('Error al leer el archivo JSON.');
    }
});

async function funAdrress(cadena) {
    const partes = cadena.split(",");
    const address=partes[0] || "Cra. 10, Cl. 15 Nte. #59";
    const neighborhood= partes[1] || "NA";
    const freeReference= partes[2] || "NA"; 
    
    try {
        const coordenadas = await obtenerCoordenadas(address, "Popayán, Cauca", "Colombia");
        return [address, coordenadas[0], coordenadas[1], neighborhood, freeReference];
    } catch (error) {
        console.error('Error al obtener coordenadas:', error);
        return [address, 0, 0, neighborhood, freeReference];
    }
}

async function obtenerCoordenadas(direccion, ciudad, pais) {
    const direccionCompleta = `${direccion}, ${ciudad}, ${pais}`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccionCompleta)}&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
        const resultado = data.results[0];
        const coordenadas = resultado.geometry.location;
        const latitud = coordenadas.lat;
        const longitud = coordenadas.lng;
        return [latitud, longitud];
    } else {
        console.error('No se pudo obtener la geocodificación para la dirección proporcionada.');
        return [0 , 0];
    }
    
}

exports.insertCredits = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('creditsMuestra.json', 'utf8');
        const data = JSON.parse(jsonData);
     //   console.log(data);
        const creditsValues = Object.values(data);

        // Obtener una referencia a la colección en Firestore donde deseas insertar los documentos
        const collectionRef = admin.firestore().collection('credits');
        
        // Procesar los documentos y agregarlos a la colección
        let batch = admin.firestore().batch();
        const batchSize = 20; // Tamaño máximo de lote
        const maxBatches = 300; // Límite máximo de lotes a insertar
        let batchesInserted = 0; // Contador de lotes insertados
        let cont = 0;
        let cont2 = 0;

        console.log("Tamaño Json: "+ creditsValues.length); //  registros
        for (const doc of creditsValues) {
            cont=cont+1;
            cont2=cont2+1;
                                  
                const idC= doc.idCredit || "A_"+Math.floor(Math.random() * 100) + 1;
                const idCredit=idC+"";
                const cell=doc.cell+"";                
                const docRef = collectionRef.doc(idCredit); // 
                const timeCredit= parteEntera(doc.time);
                const wayPay =calculateWayPay(timeCredit, Number(doc.numberFee));
                const idTask =idCredit+"A_"+Math.floor(Math.random() * 100) + 1;
                const idCustomer=doc.customer;
            
            const snapshot= await admin.firestore().collection('customers').doc(idCustomer).get();
           // console.log("Customer:  "+idCustomer+"  - "+snapshot.exists+ " - "+snapshot.empty);
            if (!snapshot.exists) {
                console.log('No existe customer con:  '+idCustomer);                
            } 
            else{
                const dataCustomer=snapshot.data();
                //console.log(dataCustomer);

                const addressCustomer=dataCustomer.address.address1.address;
                const latCustomer=dataCustomer.address.address1.lat;
                const lonCustomer=dataCustomer.address.address1.lon;
                const neighborhoodCustomer=dataCustomer.address.address1.neighborhood;
                const freeReferenceCustomer=dataCustomer.address.address1.freeReference;
                const zoneCustomer=dataCustomer.zone;
                const nameCustomer=dataCustomer.name.name;
                const lastNameCustomer=dataCustomer.name.lastName;              


                const dataNewTask={
                    id:idTask,
                    date: doc.nextPay,
                    idCredit: idCredit,
                    address: addressCustomer,
                    dateChange: null,
                    lat: latCustomer,
                    lon: lonCustomer,
                    type: "creditToCollect",
                    idUser: "1061717912",
                    phone: cell,
                    zone:zoneCustomer,
                    name: nameCustomer,
                    lastName: lastNameCustomer,
                    idCustomer:idCustomer,
                    idVisit: null,
                    stateTask: "pending"                                       
                }    
                const refTask=admin.firestore().collection('tasks').doc(doc.nextPay).collection("tasks").doc(idTask);
                batch.set(refTask, dataNewTask);
                
                const restructuredData = {
                    id: idCredit,
                    balance:Number(doc.balance),
                    by:"Carlos Andres Silva Vela",
                    idUser:"1061717925",
                    capitalToPay:Number(doc.capitaltoPay),
                    creditStatus:"active",
                    commissions:0,
                    changeDatePay:null,
                    date:doc.date,
                    nextPay:doc.nextPay,
                    numberFee:Number(doc.numberFee),
                    percentage:Number(doc.percentage),
                    timeCredit: timeCredit,
                    totalPay:Number(doc.totalPay),
                    utilityCredit:Number(doc.utilityCredit),
                    utilityToPay:Number(doc.utilitytoPay),
                    utilityPartial:Number(doc.utilityPartial),
                    value:Number(doc.value),
                    valueFee:Number(doc.valueFee),
                    imageReference:null,
                    wayPay:wayPay,
                    name:nameCustomer,
                    lastName:lastNameCustomer,
                    cellphone:cell,
                    address:addressCustomer,
                    lat:latCustomer,
                    lon:lonCustomer,
                    neighborhood:neighborhoodCustomer,
                    addressFreeReference:freeReferenceCustomer,
                    customerId:idCustomer,
                    refusesToSign:true,
                    creditCommissionPaymentMedium:0,
                    zone:zoneCustomer,
                    dateLastPay:null,
                    idTask:idTask,
                    toDateUntil:null,
                    receiptPrintedAmount:0

                };
                batch.set(docRef, restructuredData);
                               
                if(cont >= 50){
                    console.log('Ingreso al IF  cont=== 50');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        cont=0;

                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                }    
            }                        
        }

        if (cont > 0) {

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
        
        }
       
        
    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
        response.status(500).send('Error al leer el archivo JSON.');
    }
});

exports.insertPayments = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('paymentsMuestra.json', 'utf8');
        const data = JSON.parse(jsonData);
     //   console.log(data);
        const paymentsValues = Object.values(data);

        // Obtener una referencia a la colección en Firestore donde deseas insertar los documentos
        const collectionRef = admin.firestore().collection('payments');
        
        // Procesar los documentos y agregarlos a la colección
        let batch = admin.firestore().batch();
        const batchSize = 20; // Tamaño máximo de lote
        const maxBatches = 300; // Límite máximo de lotes a insertar
        let batchesInserted = 0; // Contador de lotes insertados
        let cont = 0;
        let cont2 = 0;

        console.log("Tamaño Json: "+ paymentsValues.length); //  registros
        
        for (const doc of paymentsValues) {
            cont=cont+1;
            cont2=cont2+1;                                  
                
                const idPayment=doc.id+"";
                const docRef = collectionRef.doc(idPayment); // 
                const typePay= tipoPago(doc.type);

                console.log(cont2+". "+idPayment);
              
                const restructuredData = {
                    id: doc.id,
                    date:doc.date,
                    customer:doc.name,
                    idCustomer:doc.customer,
                    valuePay:Number(doc.value),
                    userName:doc.collector,
                    idUser:"1061717925",
                    idCredit:doc.idCredit,
                    type:typePay,
                    paymentMedium:"efectivo",
                    imageReferencePay:null,
                    commissionToCredit:false,
                    valueCommissionPaymentMedium:0,
                    creditCommissionPaymentMedium:0,
                    toDateUntil:null,
                    extensionDays:0,
                    nextPayDate:null,
                    receiptPrintedAmount:0,
                    utilityPart:Number(doc.utility),
                    capitalPart:Number(doc.capital)
                };
                batch.set(docRef, restructuredData);
                               
                if(cont >= 90){
                    console.log('Ingreso al IF  cont=== 90');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        cont=0;

                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                }                                    
        }

        if (cont > 0) {

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
        
        }
       
        
    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
        response.status(500).send('Error al leer el archivo JSON.');
    }
});

function tipoPago(tipo) {
    
    switch (tipo){
        case "Int-Cap":
            return "ordinary";
        case "Intereses":
            return "interest";
        case "Capital":
            return "capital";
        case "Int-Especial":
            return "specialInterest";
        default:
            return "ordinary";
    }
}

function parteEntera(cadena) {
    const resultado = cadena.match(/\d+/); // Extrae la parte numérica
    const jj = resultado ? parseInt(resultado[0], 10) : null; // Convierte a entero y devuelve, o null si no encuentra un número
    if(jj === null){
        return 30;
    }
    return  (jj * 30);
}

function calculateWayPay(dias, cuotas) {
    const meses=dias/30;
    const factor =meses/cuotas;
    switch (factor){
        case 0.25:
            return "weekly";
        case 0.5:
            return "biweekly";
        case 1:
            return "monthly";
        default:
            return "monthly";
    }
}

/* 
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
*/

exports.updateCustomersNumberCredits = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('customerCreditsNumber.json', 'utf8');
        const data = JSON.parse(jsonData);
     //   console.log(data);
        const customerValue = Object.values(data);

        // Obtener una referencia a la colección en Firestore donde deseas insertar los documentos
        const collectionRef = admin.firestore().collection('customers');
        
        // Procesar los documentos y agregarlos a la colección
        let batch = admin.firestore().batch();        
        let cont = 0;       
        console.log("Tamaño Json: "+ customerValue.length); //  registros
        
        for (const doc of customerValue) {
            cont=cont+1;                        
                
                const docRef = collectionRef.doc(doc.customer); //                

                const restructuredData = {
                    activeCredits:Number(doc.count)
                };
                batch.update(docRef, restructuredData);
                               
                if(cont >= 90){
                    console.log('Ingreso al IF  cont=== 90');
                    await batch.commit()
                        .then(() => {
                        console.log('Commit del lote exitoso');
                        batch = admin.firestore().batch();
                        cont=0;

                    })
                    .catch(error => {
                        console.error('Error al hacer el commit del lote:', error);
                    });
                }                                    
        }

        if (cont > 0) {

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
        
        }
       
        
    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
        response.status(500).send('Error al leer el archivo JSON.');
    }
});