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
