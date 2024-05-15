

const {onRequest} = require("firebase-functions/v2/https");
const {onCall} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const logger = require("firebase-functions/logger");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onDocumentUpdated } = require("firebase-functions/v2/firestore");
const pointInPolygon = require('point-in-polygon');

/**
 * Init Firestore Admin
 */
const apiKey='AIzaSyDLxCPZqwC3qo61Sv0EsCNKpRf3Oj0IzSk';

const admin = require('firebase-admin');
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
        responseMessage = 'Clientes actualizados correctamente';
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
            saveCustomer(customer);
            break;
        } 
    }
    return customer;
}

/**
 * Save Customer in database 
 * @param {any} customer element customer of database
 */
function saveCustomer(customer) {
    admin.firestore().collection(CUSTOMERS_COLLECTION_NAME).doc(customer.id).set(customer);
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
            points : zone.polygon.map(polygonPoint => [polygonPoint.lat, polygonPoint.lon])
        };
    });
    return result;
}


async function obtenerCoordenadas(direccion, ciudad, pais) {
    
    const direccionCompleta = `${direccion}, ${ciudad}, ${pais}`;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(direccionCompleta)}&key=${apiKey}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            // Verificar si se obtuvieron resultados de geocodificación
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
        })
        .catch(error => {
            console.error('Hubo un error al obtener las coordenadas:', error);
        });
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

exports.reviewTask = onSchedule("every day 23:30", async (event) => {
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

            saveTask(dataNewTask, id, tomorrow);
            updateTask(dataUpdateTask,id, today);
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
      
       // savePay(dataPay, idPay, idCredit,date);
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
  
  async function savePay(dataP, idPay, idCredit, date) {
    await admin.firestore().collection('credits').doc(idCredit+"").collection("payments").doc(idPay+"").set(dataP);
 //   await admin.firestore().collection('payments').doc(date+"").collection("payments").doc(idPay+"").set(dataP);
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