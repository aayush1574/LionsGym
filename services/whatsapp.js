const axios = require('axios');
const { getAll, runQuery } = require('../db/database');

async function sendWhatsAppMessage(phone, name, expiryDate) {
    const token = process.env.WHATSAPP_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_ID;

    if (!token || token === 'your_whatsapp_cloud_api_token_here' || !phoneId || phoneId === 'your_whatsapp_phone_number_id_here') {
        console.log(`⚠️  WhatsApp not configured. Would send to ${phone}: Hi ${name}, your gym membership expires on ${expiryDate}. Please renew!`);
        return false;
    }

    try {
        let formattedPhone = phone.replace(/[^0-9]/g, '');
        if (formattedPhone.length === 10) {
            formattedPhone = '91' + formattedPhone;
        }

        await axios.post(
            `https://graph.facebook.com/v18.0/${phoneId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: formattedPhone,
                type: 'text',
                text: {
                    body: `🏋️ The Royal Fitness Gym\n\nHi ${name}! Your gym membership is expiring on ${expiryDate}.\n\nPlease visit the gym or contact us to renew your membership.\n\n📞 9981219521 / 8770584692\n📍 Royal City, Near Kushum Devi Garden, Jail Road Vidisha`
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ WhatsApp message sent to ${phone} (${name})`);
        return true;
    } catch (err) {
        console.error(`❌ WhatsApp send failed for ${phone}:`, err.response?.data || err.message);
        return false;
    }
}

async function checkAndNotify() {
    console.log('🔍 Checking for memberships expiring in 7 days...');

    try {
        const expiringMembers = getAll(`
      SELECT m.id as membership_id, m.end_date, m.notified, u.name, u.phone, u.email
      FROM memberships m
      JOIN users u ON m.user_id = u.id
      WHERE m.end_date = DATE('now', '+7 days')
        AND m.notified = 0
        AND m.payment_status = 'paid'
    `);

        if (expiringMembers.length === 0) {
            console.log('✅ No memberships expiring in 7 days.');
            return;
        }

        console.log(`📋 Found ${expiringMembers.length} membership(s) expiring in 7 days.`);

        for (const member of expiringMembers) {
            const success = await sendWhatsAppMessage(member.phone, member.name, member.end_date);

            if (success) {
                runQuery('UPDATE memberships SET notified = 1 WHERE id = ?', [member.membership_id]);
            }
        }
    } catch (err) {
        console.error('❌ Notification check error:', err);
    }
}

module.exports = { sendWhatsAppMessage, checkAndNotify };
