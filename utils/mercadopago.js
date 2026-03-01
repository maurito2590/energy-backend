const axios = require('axios');

const mercadopagoAPI = axios.create({
  baseURL: 'https://api.mercadopago.com/v1',
  headers: {
    Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
  },
});

exports.createPaymentPreference = async (transaction) => {
  try {
    const preference = {
      items: [
        {
          id: transaction._id,
          title: transaction.productCode,
          currency_id: 'ARS',
          quantity: 1,
          unit_price: transaction.amount,
        },
      ],
      payer: {
        email: transaction.userEmail,
      },
      back_urls: {
        success: `${process.env.CLIENT_URL}/payment-success`,
        failure: `${process.env.CLIENT_URL}/payment-failure`,
        pending: `${process.env.CLIENT_URL}/payment-pending`,
      },
      notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`,
      auto_return: 'approved',
      external_reference: transaction._id.toString(),
    };

    const response = await mercadopagoAPI.post('/checkout/preferences', preference);
    return response.data;
  } catch (error) {
    console.error('MercadoPago Error:', error.response?.data || error.message);
    throw error;
  }
};

exports.getPaymentInfo = async (paymentId) => {
  try {
    const response = await mercadopagoAPI.get(`/payments/${paymentId}`);
    return response.data;
  } catch (error) {
    console.error('MercadoPago Error:', error.response?.data || error.message);
    throw error;
  }
};

exports.verifyWebhookSignature = (xSignature, xRequestId, dataId, secret) => {
  // MercadoPago webhook signature verification
  // Implementation depends on their latest specs
  return true; // Placeholder
};
