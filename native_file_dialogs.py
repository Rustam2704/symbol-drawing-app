import tkinter as tk
from tkinter import filedialog


def _create_dialog_root(dialog_x, dialog_y):
    root = tk.Tk()
    root.geometry(f"1x1+{dialog_x}+{dialog_y}")
    root.attributes("-topmost", True)
    root.attributes("-alpha", 0.01)
    root.update_idletasks()
    root.lift()
    return root


def _show_dialog(dialog, *, initial_dir, dialog_x, dialog_y, **options):
    root = _create_dialog_root(dialog_x, dialog_y)
    try:
        return dialog(parent=root, initialdir=initial_dir, **options)
    finally:
        root.destroy()


def select_image_folder(initial_dir, dialog_x, dialog_y):
    return _show_dialog(
        filedialog.askdirectory,
        initial_dir=initial_dir,
        dialog_x=dialog_x,
        dialog_y=dialog_y,
        title="Select image folder",
    )


def select_image_or_pdf(initial_dir, dialog_x, dialog_y):
    return _show_dialog(
        filedialog.askopenfilename,
        initial_dir=initial_dir,
        dialog_x=dialog_x,
        dialog_y=dialog_y,
        title="Choose image or PDF",
        filetypes=[
            ("Images and PDF", "*.png *.jpg *.jpeg *.webp *.ico *.avif *.gif *.svg *.pdf"),
            ("Images", "*.png *.jpg *.jpeg *.webp *.ico *.avif *.gif *.svg"),
            ("PDF", "*.pdf"),
            ("All files", "*.*"),
        ],
    )
