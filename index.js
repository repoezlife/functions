

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
const { resolve } = require("path");
const { rejects } = require("assert");
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
    getZoneByCustomer(customer).then(zoneCustomer => {
        customer.zone = zoneCustomer;
        saveCustomer(customer);
    });
});

/**
 * Update Customer
 */

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
 * Return zones data
 */
const getZonesData = new Promise((resolve, reject) => {
    console.log('buscando zonas...');
    const refZones = admin.firestore().collection(ZONE_COLLECTION_NAME);
    refZones.get().then(zonesSnapshot => {
        if (zonesSnapshot.empty) {
            let responseMessage = 'No matching documents in Zones.';
            console.log(responseMessage);
        }
        let zones = [];
        zonesSnapshot.forEach(zoneData => {
            zones.push(zoneData.data());
        });
        console.log(zones);
        resolve(zones);
    });
});

/* function getZonesData() {
    return new Promise((resolve, reject) => {
        console.log('buscando zonas...');
        const refZones = admin.firestore().collection(ZONE_COLLECTION_NAME);
        refZones.get().then(zonesSnapshot => {
            if (zonesSnapshot.empty) {
                let responseMessage = 'No matching documents in Zones.';
                console.log(responseMessage);
            }
            let zones = [];
            zonesSnapshot.forEach(zoneData => {
                zones.push(zoneData.data());
            });
            resolve(zones);
        });
    });
}
 */
/**
 * Get Zone By customer
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
    const snapshot = await refTasks.orderBy("zone", "desc").get();
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

            const id=data.id;
            const idC=data.idCredit;
            const tp=data.type;
            const idV=data.idVisit;

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
                userWhoModified:null
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

  async function saveTask(dataT, id, date) {
    await admin.firestore().collection('tasks').doc(date).collection("tasks").doc(id).set(dataT).then(() => {
        console.log('Documento Creado exitosamente. ' + id);
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

  async function updateVisit(dataVisit, idVisit) {
    const visitRef = admin.firestore().collection("visits").doc(idVisit+"");
    await creditRef.update(dataVisit).then(() => {
        console.log(idVisit + '  Visita actualizado exitosamente. ' + dataVisit);
      })
      .catch((error) => {
        console.error(idVisit+ '  Error al actualizar el credito:', error);
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

console.log(" Abono a crédito:  "+idCredit +"  Con pago de id:    "+idPay);
console.log(" Llamado Funcióncon Type:  "+type +"  valor CreditCommissionPayMediium:    "+creditCommissionPaymentMedium);
//console.log("Información que llega del abono /n:   "+data);

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


async function updatePay(dataP, idPay) {
    await admin.firestore().collection('payments').doc(idPay+"").update(dataP).then(() => {
        console.log(idPay + 'Pago actualizado exitosamente. ' + dataP);
      })
      .catch((error) => {
        console.error(idPay+ 'Error al actualizar el pago:', error);
      });
   }
 /* */
 
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
        const dlp= data.dateLastPay;
        console.log("Credit: "+data.id);
        const today =new Date(formatoFecha3());
        console.log("DateLastPay  "+ dlp);

        if(dlp != null){
            const dateLastPay = parseFecha(data.dateLastPay);
            
            const diferencia=Math.abs(today-dateLastPay);
            const diferenciaDias = Math.ceil(diferencia / (1000 * 60 * 60 * 24));
            const condicion=diferenciaDias-wayPay;

            console.log( "Hoy:  "+today+ " /Dif días 1:  "
                +diferenciaDias + " wayPay: "+wayPay+ " /condición :  "+condicion); 

            if(condicion > 5 && data.creditStatus!="slowPayer" && data.creditStatus!="expired"){
                const dataCredit={
                    creditStatus:"slowPayer"
                }
                console.log("último pago:  "+dateLastPay+ " /Dif días:  "+diferenciaDias);
                console.log("slowPayer");
                updateCredit(dataCredit, data.id);                            
            }

        }
        

        const fechaCredito=parseFecha(data.date);
        const diferencia2=Math.abs(today-fechaCredito);
        const diferenciaDias2 = Math.ceil(diferencia2 / (1000 * 60 * 60 * 24));
        const condicion2=diferenciaDias2-(data.timeCredit*1);        
        
        console.log("Fecha Crédito:  " +fechaCredito+ "/Hoy:  "+today+ " /Dif días 2:  "
            +diferenciaDias2 + " /Tiempo crédito: "+data.timeCredit+ " /condición 2:  "+condicion2);  
        
        
        if(condicion2>=1 && data.creditStatus!="expired"){
            const dataCredit={
                creditStatus:"expired"
            }
            updateCredit(dataCredit, data.id);
            console.log("expired");
        }
   

      });  
  
});

function parseFecha(fechaString) {
    const partes = fechaString.split('-');
    const dia = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const anio = parseInt(partes[2], 10);

    return new Date(anio, mes, dia);
}

function formatoFecha3() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


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
    console.log("Eliminar IdPay: "+data.idPay);
    console.log(data);

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

    console.log("Update Credits and task,  "+idCustomer+"  "+zona+"  "+activeCredits);
    
    const refCredits=admin.firestore().collection("credits");
    const credits=await refCredits.where('customerId', "==", idCustomer).get();
    let batch = admin.firestore().batch();
    let cB=0;

    if (!credits.empty) {
        credits.forEach(async doc => {
            if(doc.creditStatus != 'expired'){
                const dt= doc.data();
                console.log("UpdateCredit: "+dt.id+"  UpdateTask: "+dt.nextPay+"/"+dt.idTask);

                const dataZone={
                    zone:zona
                }
                const refT=admin.firestore().collection("tasks").doc(dt.nextPay).collection("tasks").doc(dt.idTask);
                const refC=admin.firestore().collection("credits").doc(dt.id+"");                   
               batch.update(refT, dataZone);
               batch.update(refC, dataZone);
               cB++;
                
            }
            else{
                console.log('No se encontraron creditos activos a nombre de '+idCustomer);
            }            
        });
        if(cB>0){
            console.log('Ingreso al IF  cont > 0');
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
        console.log('No se encontraron creditos a nombre de '+idCustomer);
        return;
    }   

}

async function updateCredit(dataCred, idCredit) {
    const creditRef = admin.firestore().collection("credits").doc(idCredit+"");
    await creditRef.update(dataCred).then(() => {
        console.log(idCredit + '  Credito actualizado exitosamente. ' + dataCred);
      })
      .catch((error) => {
        console.error(idCredit+ '  Error al actualizar el credito:', error);
      });
  }

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


/* 

//Funciones para actualizar los datos

exports.insertCredits = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('creditsActives.json', 'utf8');
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
                const idTask =idCredit;
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
                const neighborhoodCustomer=dataCustomer.address.address1.neighborhood || "";
                const freeReferenceCustomer=dataCustomer.address.address1.freeReference || "";
                const zoneCustomer=dataCustomer.zone || -1;
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
                    stateTask: "pending",
                    userWhoModified:null                                       
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
                               
                if(cont >= 200){
                    console.log('Ingreso al IF  cont=== 200');
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
                               
                if(cont >= 150){
                    console.log('Ingreso al IF  cont=== 150');
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

exports.insertPayments = onRequest(async (request, response) => {
    try {
        // Leer el archivo JSON con los documentos
        const jsonData = fs.readFileSync('paymentsActives.json', 'utf8');
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
            console.log(cont2+". "+idPayment);

          //  if(doc.hasOwnProperty(value)){

                
                const docRef = collectionRef.doc(idPayment); // 
                const typePay= tipoPago(doc.type);
                const coll= doc.collector || "";
                const val= Number(doc.value) || 0;               
                const dat= (doc.date) || "01-01-2000";  
              
                const restructuredData = {
                    idPay: idPayment,
                    date:doc.date,
                    customer:doc.name,
                    idCustomer:doc.customer,
                    valuePay:val,
                    userName:coll,
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
                               
                if(cont >= 400){
                    console.log('Ingreso al IF  cont=== 400');
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

          //  }
                
                                                   
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
 */
