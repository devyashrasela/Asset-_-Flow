import re

# Update authRouter.js
with open("/home/mium/code/Asset-_-Flow/backend/src/routes/authRouter.js", "r") as f:
    code = f.read()

if "linkSlack" not in code:
    code = code.replace(
        "selectWorkspace\n} from '../controllers/authController.js';",
        "selectWorkspace,\n  linkSlack\n} from '../controllers/authController.js';"
    )
    code = code.replace(
        "router.get('/me', authenticateToken, me);",
        "router.get('/me', authenticateToken, me);\nrouter.post('/link-slack', authenticateToken, linkSlack);"
    )
    with open("/home/mium/code/Asset-_-Flow/backend/src/routes/authRouter.js", "w") as f:
        f.write(code)

# Update authController.js
with open("/home/mium/code/Asset-_-Flow/backend/src/controllers/authController.js", "r") as f:
    code = f.read()

if "linkSlack" not in code:
    link_slack_code = """
export const linkSlack = async (req, res) => {
  const { email, slack_user_id } = req.body;
  if (!email || !slack_user_id) {
    return res.status(400).json({ error: 'Email and slack_user_id are required.' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    user.slack_user_id = slack_user_id;
    await user.save();
    return res.json({ message: 'Slack account linked successfully.', user: { id: user.id, email: user.email, slack_user_id } });
  } catch (err) {
    console.error('Error linking slack:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};
"""
    with open("/home/mium/code/Asset-_-Flow/backend/src/controllers/authController.js", "a") as f:
        f.write(link_slack_code)

print("Added /link-slack endpoint to backend.")
