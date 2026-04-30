"""
Telegram Bot listener for ABCs Agent
"""
import os
import uuid
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, MessageHandler, CallbackQueryHandler, filters, ContextTypes

from config import TELEGRAM_BOT_TOKEN
from orchestrator import Orchestrator

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# Initialize orchestrator
orchestrator = Orchestrator()
graph = orchestrator.build_graph()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Send a message when the command /start is issued."""
    await update.message.reply_text("Hello! I am your ABCs Agent. Send me a T trigger (e.g., 'T: B http...') or C trigger ('C: B->A->D')!")

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Pass messages to LangGraph."""
    user_id = str(update.effective_user.id)
    text = update.message.text
    config = {"configurable": {"thread_id": user_id}}
    
    # Check if we are waiting for a role text reply
    if context.user_data.get("waiting_for_role"):
        context.user_data["waiting_for_role"] = False
        
        # Update the paused graph state with the role
        graph.update_state(config, {"user_role": text})
        
        snapshot = graph.get_state(config)
        proposed_path = snapshot.values.get("proposed_path", [])
        
        # Now send the proposal with buttons
        keyboard = [
            [InlineKeyboardButton("Approve Path", callback_data="approve")],
            [InlineKeyboardButton("Reject", callback_data="reject")]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        await update.message.reply_text(
            f"Role acknowledged: {text}\n\nI propose the following execution path: {proposed_path}\nDo you approve?",
            reply_markup=reply_markup
        )
        return
    
    # Simple LangGraph invocation
    state = {
        "messages": [{"role": "user", "content": text}],
        "task_id": str(uuid.uuid4())[:8],
        "trigger_type": "T",
        "destination": "",
        "topic": "",
        "user_role": "",
        "proposed_path": [],
        "current_step": 0,
        "context": {},
        "user_feedback": ""
    }
    
    await update.message.reply_text("Processing your request...")
    
    # Run the graph
    try:
        events = graph.stream(state, config, stream_mode="updates")
        
        for event in events:
            # If the graph pauses (interrupts)
            snapshot = graph.get_state(config)
            if snapshot.next and snapshot.next[0] == "NodeC_Role":
                # It hit a 'C' trigger and is asking for role via text
                dest = snapshot.values.get("destination", "B")
                topic = snapshot.values.get("topic", "General")
                
                await update.message.reply_text(
                    f"Your destination is '{dest}' for topic '{topic}'.\n"
                    "What specific role should I adopt on your behalf? (Please reply with text)"
                )
                context.user_data["waiting_for_role"] = True
                return # Exit early to wait for text reply
            
            # Otherwise just inform progress
            for node_name, node_state in event.items():
                logger.info(f"Node {node_name} completed.")
                if node_name.startswith("Node"):
                    await update.message.reply_text(f"Completed {node_name} successfully.")
                    
        await update.message.reply_text("Task finished!")
        
    except Exception as e:
        logger.error(f"Graph execution failed: {e}")
        await update.message.reply_text(f"An error occurred: {e}")

async def handle_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle Human-in-the-loop approvals."""
    query = update.callback_query
    await query.answer()
    
    user_id = str(update.effective_user.id)
    config = {"configurable": {"thread_id": user_id}}
    
    if query.data == "approve":
        await query.edit_message_text(text="Path approved. Resuming execution...")
        # Resume the graph
        try:
            events = graph.stream(None, config, stream_mode="updates")
            for event in events:
                for node_name, node_state in event.items():
                    if node_name.startswith("Node"):
                        await context.bot.send_message(chat_id=update.effective_chat.id, text=f"Completed {node_name} successfully.")
            await context.bot.send_message(chat_id=update.effective_chat.id, text="Task finished!")
        except Exception as e:
            await context.bot.send_message(chat_id=update.effective_chat.id, text=f"Resumed execution failed: {e}")
    else:
        await query.edit_message_text(text="Task cancelled.")

def main():
    if not TELEGRAM_BOT_TOKEN:
        logger.error("TELEGRAM_BOT_TOKEN not found in environment variables.")
        return

    logger.info("Starting ABCs Telegram Bot...")
    application = ApplicationBuilder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    application.add_handler(CallbackQueryHandler(handle_callback))

    application.run_polling()

if __name__ == "__main__":
    main()
