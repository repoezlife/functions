
/* 
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

exports.updatePayment = onDocumentUpdated("/payments/{idPay}", (event) => {
    
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





exports.printCustomers = onRequest(async (request, response) => {
    const customers = admin.firestore().collection("payments");
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
        response("Actualización OK");
    }
});


 */

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
        const cobs=await refUsers.where('role.code', "==","COB").orderBy("cobPosition", "asc").get();
        
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