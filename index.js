

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
const { log } = require("console");
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
exports.distributeTasks = onSchedule(
    {schedule: 'every day 23:30',
    timeZone: 'America/Bogota', },
     async (event) => {

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
   

    const refConfig= admin.firestore().collection("settings").doc("specialRoute");
    const snp= await refConfig.get();
    if (!snp.empty) {
        const x=snp.data();
        idSpRoute=x.idUser;
        nCll=Number(x.collections);        
    }
    console.log(idSpRoute+":  "+nCll);

    const refTasks= admin.firestore().collection("tasks").doc(tomorrow+"").collection("tasks");
    const snapshot = await refTasks.orderBy("zone", "asc").get();
    if (!snapshot.empty) {
        
        snapshot.forEach(doc => {
            const f=doc.data();
            console.log(f);
            if(f.stateTask === 'pending'){
                idTasks.push(doc.id);
            }
            
          });
          nTasks=idTasks.length;
    }
    else{
        console.log('No hay tareas para '+today);
        band=false;
    }
    if(band){
        const refUsers=admin.firestore().collection("users");
        const cobs=await refUsers.where('role.code', "==","COB").get();
        
        if (!cobs.empty) {
            cobs.forEach(doc => {
                if(doc.id != idSpRoute){
                    idCobs.push(doc.id);
                }
                
            });
            idCobs.push(idSpRoute);
            console.log(idCobs);
            nCobs = (idCobs).length;
        } else {
            console.log('No se encontraron documentos con role.code igual a "COB".');
            return;
        }
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

        for(let i=0; i<(nCobs-1) ;i++){
            cont++;            
            for(u; u<(cont*nTareasEq);u++){
                const ref=refTasks.doc(idTasks[u]+"");
                const dataT={
                    idUser:idCobs[i]
                }
                batch.update(ref, dataT);
                contBatch++;
                console.log(u+". "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i);
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
        for(u; u<nTasks;u++){

           // console.log("Ingreso último for, U: "+ u);
            const ref=refTasks.doc(idTasks[u]+"");
            const dataT={
                idUser:idCobs[nCobs-1]
            }
            batch.update(ref, dataT);
            contBatch++;
            console.log(u+". "+idTasks[u]+ "  "+idCobs[nCobs-1] );

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
      //  response("Actualización OK");
    
});
exports.todayDistributeTasks = onRequest(async (request, response) => {

    let band=true;
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
    let tomorrow= formatoFecha2();
    let today= formatoFecha();

    const refConfig= admin.firestore().collection("settings").doc("specialRoute");
    const snp= await refConfig.get();
    if (!snp.empty) {
        const x=snp.data();
        idSpRoute=x.idUser;
        nCll=Number(x.collections);        
    }
    console.log(idSpRoute+":  "+nCll);

    const refTasks= admin.firestore().collection("tasks").doc(today+"").collection("tasks");
    const snapshot = await refTasks.orderBy("zone", "asc").get();
    if (!snapshot.empty) {
        
        snapshot.forEach(doc => {
            const f=doc.data();
            console.log(f);
            if(f.stateTask === 'pending'){
                idTasks.push(doc.id);
            }
            
          });
          nTasks=idTasks.length;
    }
    else{
        console.log('No hay tareas para '+today);
        band=false;
    }
    if(band){
        const refUsers=admin.firestore().collection("users");
        const cobs=await refUsers.where('role.code', "==","COB").get();
        
        if (!cobs.empty) {
            cobs.forEach(doc => {
                if(doc.id != idSpRoute){
                    idCobs.push(doc.id);
                }
                
            });
            idCobs.push(idSpRoute);
            console.log(idCobs);
            nCobs = (idCobs).length;
        } else {
            console.log('No se encontraron documentos con role.code igual a "COB".');
            return;
        }
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

        for(let i=0; i<(nCobs-1) ;i++){
            cont++;            
            for(u; u<(cont*nTareasEq);u++){
                const ref=refTasks.doc(idTasks[u]+"");
                const dataT={
                    idUser:idCobs[i]
                }
                batch.update(ref, dataT);
                contBatch++;
                console.log(u+". "+idTasks[u]+ "  "+idCobs[i] +"  i:"+i);
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
        for(u; u<nTasks;u++){

           // console.log("Ingreso último for, U: "+ u);
            const ref=refTasks.doc(idTasks[u]+"");
            const dataT={
                idUser:idCobs[nCobs-1]
            }
            batch.update(ref, dataT);
            contBatch++;
            console.log(u+". "+idTasks[u]+ "  "+idCobs[nCobs-1] );

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
    return
});

exports.reviewTasks = onSchedule(
    {schedule: 'every day 23:00',
    timeZone: 'America/Bogota', }, 
    async (event) => {
        
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
        console.log('Tarea actualizada exitosamente. ' + id);
      })
      .catch((error) => {
        console.error('Error al actualizar tarea :', error);
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
 /* */
  async function updateCredit(dataCred, idCredit) {
    const creditRef = admin.firestore().collection("credits").doc(idCredit+"");
    await creditRef.update(dataCred).then(() => {
        console.log('Credito actualizado exitosamente. ' + idCredit);
      })
      .catch((error) => {
        console.error('Error al actualizar el credito:', error);
      });
  }
  async function registerPayCommission(dataP, idPay) {
    await admin.firestore().collection('payments').doc(idPay).set(dataP);
 //   await admin.firestore().collection('payments').doc(date+"").collection("payments").doc(idPay+"").set(dataP);
  }

  exports.updateStateCredits = onSchedule(
    {schedule: 'every day 05:30',
    timeZone: 'America/Bogota', },
     async (event) => {
        
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

async function updateZoneCreditsTasks(idCustomer, zona, activeCredits){
    
    const refCredits=admin.firestore().collection("credits");
    const credits=await refCredits.where('customerId', "==", idCustomer).get();

    if (!credits.empty) {
        credits.forEach(async doc => {
            if(doc.creditStatus != 'expired'){
                const dataZone={
                    zone:zona
                }                
               updateTask(dataZone, doc.idTask, doc.nextPay);
               updateCredit(dataZone, doc.id);
            }
            else{
                console.log('No se encontraron creditos activos a nombre de '+idCustomer);
            }            
        });
       
    } else {
        console.log('No se encontraron creditos a nombre de '+idCustomer);
        return;
    }
    

}
