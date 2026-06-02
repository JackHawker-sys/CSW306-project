namespace RestaurantManagement.Services
{
    public interface IEmailService
    {
        Task SendVerificationCodeAsync(String toEmail, String fromEmail);
    }
}
