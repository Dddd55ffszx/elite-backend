import express from 'express';
import User from '../models/User.js';
import { sendApprovalStatusEmail } from '../utils/emailService.js';

const router = express.Router();

// Approve user
router.get('/approve-user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).send(`
        <html>
          <head>
            <style>
              body { 
                background: linear-gradient(to bottom, #000000, #18181b); 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                font-family: Arial, sans-serif;
              }
              .message { 
                text-align: center; 
                padding: 40px; 
                background: rgba(0,0,0,0.8); 
                border-radius: 15px; 
                border: 1px solid rgba(212, 175, 55, 0.2);
                box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
              }
              h1 { color: #fbbf24; }
              p { color: #9ca3af; }
            </style>
          </head>
          <body>
            <div class="message">
              <h1>User Not Found</h1>
              <p>The user you're trying to approve doesn't exist.</p>
            </div>
          </body>
        </html>
      `);
    }

    if (user.isApproved) {
      return res.send(`
        <html>
          <head>
            <style>
              body { 
                background: linear-gradient(to bottom, #000000, #18181b); 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                height: 100vh; 
                margin: 0; 
                font-family: Arial, sans-serif;
              }
              .message { 
                text-align: center; 
                padding: 40px; 
                background: rgba(0,0,0,0.8); 
                border-radius: 15px; 
                border: 1px solid rgba(212, 175, 55, 0.2);
                box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
              }
              h1 { color: #fbbf24; }
              p { color: #9ca3af; }
            </style>
          </head>
          <body>
            <div class="message">
              <h1>Already Approved</h1>
              <p>This user has already been approved.</p>
            </div>
          </body>
        </html>
      `);
    }

    user.isApproved = true;
    await user.save();

    // Send approval email to user
    await sendApprovalStatusEmail(user.email, 'approved');

    res.send(`
      <html>
        <head>
          <style>
            body { 
              background: linear-gradient(to bottom, #000000, #18181b); 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              font-family: Arial, sans-serif;
            }
            .message { 
              text-align: center; 
              padding: 40px; 
              background: rgba(0,0,0,0.8); 
              border-radius: 15px; 
              border: 1px solid rgba(212, 175, 55, 0.2);
              box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
            }
            h1 { color: #4ade80; }
            p { color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>✓ User Approved Successfully!</h1>
            <p>${user.name} (${user.email}) can now log in.</p>
            <p style="margin-top: 20px;">An email notification has been sent to the user.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).send(`
      <html>
        <head>
          <style>
            body { 
              background: linear-gradient(to bottom, #000000, #18181b); 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              font-family: Arial, sans-serif;
            }
            .message { 
              text-align: center; 
              padding: 40px; 
              background: rgba(0,0,0,0.8); 
              border-radius: 15px; 
              border: 1px solid rgba(212, 175, 55, 0.2);
              box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
            }
            h1 { color: #ef4444; }
            p { color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>Error</h1>
            <p>Something went wrong. Please try again.</p>
          </div>
        </body>
      </html>
    `);
  }
});

// Reject user
router.get('/reject-user/:userId', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    
    if (!user) {
      return res.status(404).send('User not found');
    }

    // Send rejection email to user
    await sendApprovalStatusEmail(user.email, 'rejected');

    // Delete the user from database
    await User.findByIdAndDelete(req.params.userId);

    res.send(`
      <html>
        <head>
          <style>
            body { 
              background: linear-gradient(to bottom, #000000, #18181b); 
              display: flex; 
              justify-content: center; 
              align-items: center; 
              height: 100vh; 
              margin: 0; 
              font-family: Arial, sans-serif;
            }
            .message { 
              text-align: center; 
              padding: 40px; 
              background: rgba(0,0,0,0.8); 
              border-radius: 15px; 
              border: 1px solid rgba(212, 175, 55, 0.2);
              box-shadow: 0 0 40px rgba(212, 175, 55, 0.15);
            }
            h1 { color: #ef4444; }
            p { color: #9ca3af; }
          </style>
        </head>
        <body>
          <div class="message">
            <h1>✗ User Rejected</h1>
            <p>${user.name} (${user.email}) has been rejected and removed.</p>
            <p style="margin-top: 20px;">A notification email has been sent.</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).send('Error rejecting user');
  }
});

export default router;