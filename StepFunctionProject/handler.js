'use strict';
const AWS = require("aws-sdk");
const StepFunction = new AWS.StepFunctions();
const DynamoDB= require("aws-sdk/clients/dynamodb");
const DocumentClient = new DynamoDB.DocumentClient({region: "us-east-2"});

const isBookAvailable = (book, Quantity) => {
  return (book.Quantity - Quantity)>0

}

module.exports.checkInventory = async ({ BookId, Quantity }) => {
    try {
        let params = {
            TableName: 'bookTable',
            KeyConditionExpression: 'BookId = :BookId',
            ExpressionAttributeValues: {
                ':BookId': BookId
            }
        };
        let result = await DocumentClient.query(params).promise();
        let book = result.Items[0];

        if (isBookAvailable(book, Quantity)) {
            return book;
        } else {
            let bookOutofStockError = new Error("The book is out of stock");
            bookOutofStockError.name = "bookOutofStock";
            throw bookOutofStockError;
        }
    } catch (e) {
        if (e.name === 'bookOutofStock') {
            throw e;
        } else {
            let bookNotFoundError = new Error(e);
            bookNotFoundError.name = 'bookNotFound';
            throw bookNotFoundError;
        }
    }
}

module.exports.calculateTotal = async ({book,Quantity}) => {
let total = book.price*Quantity;
return {total}
};

const deductpoint= async(userId) => {
  let params = {
    TableName:'userTable',
    Key: {'userId':userId},
    UpdateExpression : 'SET RedeemPoints = :zero',
    ExpressionAttributeValues: {
      ':zero' : 0
    }

  }
  await DocumentClient.update(params).promise()  

}

module.exports.redeempoints = async ({userId,total}) => {
let ordertotal =total.total;
try{ 
  let params={
    TableName:'userTable',
    Key:{
      'userId':userId
    }
  }

  let result = await DocumentClient.get(params).promise();
  let user=result.Item;

  const point=user.RedeemPoints;
  
  if(ordertotal>point/100)
  {
    await deductpoint(userId);
    ordertotal = ordertotal- point;
    return {total:ordertotal, point}
  } else {
    return "Not sufficient Redeem Points"
  }

  }
  catch(e){
  throw e;
  }
};

module.exports.billCustomer = async (params) => {
return "Succesfully billed"
};


module.exports.restoreRedeemPoints = async ({ userId, total }) => {
  try {
      if (total.point) {
          let params = {
              TableName: 'userTable',
              Key: { userId: userId },
              UpdateExpression: 'set RedeemPoints = :point',
              ExpressionAttributeValues: {
                  ':point': total.point
              }
          };
          await DocumentClient.update(params).promise();
      }
  } catch (e) {
      throw new Error(e);
  }
}

module.exports.sqsWorker = async (event) => {
  try {
      console.log(JSON.stringify(event));
      let record = event.Records[0];
      var body = JSON.parse(record.body);
      /** Find a courier and attach courier information to the order */
      let courier = "akhils070s@gmail.com";

      // update book quantity
      await updateBookQuantity(body.Input.bookId, body.Input.quantity);

     // throw "Something wrong with Courier API";

      // Attach curier information to the order
      await StepFunction.sendTaskSuccess({
          output: JSON.stringify({ courier }),
          taskToken: body.Token
      }).promise();
  } catch (e) {
      console.log("===== You got an Error =====");
      console.log(e);
      await StepFunction.sendTaskFailure({
          error: "NoCourierAvailable",
          cause: "No couriers are available",
          taskToken: body.Token
      }).promise();
  }
}

module.exports.restoreQuantity = async ({ bookId, quantity }) => {
  let params = {
      TableName: 'bookTable',
      Key: { BookId: bookId },
      UpdateExpression: 'set Quantity = Quantity + :orderQuantity',
      ExpressionAttributeValues: {
          ':orderQuantity': quantity
      }
  };
  await DocumentClient.update(params).promise();
  return "Quantity restored"
}

const updateBookQuantity = async (bookId, orderQuantity) => {
  console.log("bookId: ", bookId);
  console.log("orderQuantity: ", orderQuantity);
  let params = {
      TableName: 'bookTable',
      Key: { 'BookId': bookId },
      UpdateExpression: 'SET Quantity = Quantity - :orderQuantity',
      ExpressionAttributeValues: {
          ':orderQuantity': orderQuantity
      }
  };
  await DocumentClient.update(params).promise();
}