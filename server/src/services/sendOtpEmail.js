import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

function requireEnv(name) {
    const v = process.env[name];
    if (!v) throw new Error(`${name} is not set`);
    return v;
}

const ses = new SESClient({
    region: requireEnv("AWS_REGION")
})

export async function sendOtpEmail({ to, code }) {
    const from = requireEnv("SES_FROM_EMAIL");

    const cmd = new SendEmailCommand({
        Source: from,
        Destination: {
            ToAddresses: [to],
        },
        Message: {
            Subject: {
                Data: "Login Code for Happy Tails House",
                charset: "UTF-8",
            },
            Body: {
                Text: {
                    Data: `Your Verification code is ${code}. It expires in 10 minutes.`,
                    Charset: "UTF-8"
                },
                Html: {
                    Data: `
                        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111;">
                            <h2>Happy Tails House</h2>
                            <p>You varification code is:</p>
                            <div style="font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 12px 0;">
                                ${code}
                            </div>
                            <p>This cide exoires in 10 minutes.</p>
                            <p>If you did not request this, you can ignore this email.</p>
                        </div>
                    `,
                    Charset: "UTF-8",
                },
            },
        },
    });

    await ses.send(cmd)
    
}
