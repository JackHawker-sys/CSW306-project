using MailKit.Net.Smtp;
using Microsoft.Extensions.Options;
using MimeKit;
using RestaurantManagement.Models;
using static Org.BouncyCastle.Crypto.Engines.SM2Engine;
namespace RestaurantManagement.Services
{
    public class EmailService : IEmailService
    {
        private readonly EmailSettings _settings;
        public EmailService(IOptions<EmailSettings> options)
        {
            _settings = options.Value;
        }

        public async Task SendVerificationCodeAsync(string toEmail, string code)
        {
            try
            {
                var message = new MimeMessage();
                message.From.Add(new MailboxAddress(_settings.SenderName, _settings.SenderEmail));
                message.To.Add(MailboxAddress.Parse(toEmail));
                message.Subject = "Email Verification Code";
                message.Body = new TextPart("html")
                {
                    Text = $@"
                <h2>Restaurant Management</h2>
                <p>Your verification code is:</p>
                <h1 style='font-size:18px;color:#4F46E5;'>{code}</h1>
                
            "
                };

                using var client = new SmtpClient();
                await client.ConnectAsync(_settings.SmtpHost, _settings.SmtpPort, false);
                await client.AuthenticateAsync(_settings.Username, _settings.Password);
                await client.SendAsync(message);
                await client.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                // Log lỗi rõ ràng
                Console.WriteLine($"[EmailService ERROR] {ex.Message}");
                throw; // Ném lại để controller bắt
            }

        }

    }

}
