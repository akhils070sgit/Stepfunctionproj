'use strict';
const AWS = require("aws-sdk");
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