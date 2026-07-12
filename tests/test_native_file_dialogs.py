import unittest
from unittest.mock import Mock, patch

import native_file_dialogs


class NativeFileDialogTests(unittest.TestCase):
    @patch("native_file_dialogs._create_dialog_root")
    def test_dialog_root_is_destroyed_after_selection(self, create_root):
        root = create_root.return_value
        dialog = Mock(return_value="selected.png")

        selected = native_file_dialogs._show_dialog(
            dialog,
            initial_dir="images",
            dialog_x=20,
            dialog_y=30,
            title="Choose",
        )

        self.assertEqual(selected, "selected.png")
        dialog.assert_called_once_with(parent=root, initialdir="images", title="Choose")
        root.destroy.assert_called_once_with()

    @patch("native_file_dialogs._create_dialog_root")
    def test_dialog_root_is_destroyed_after_failure(self, create_root):
        root = create_root.return_value
        dialog = Mock(side_effect=RuntimeError("dialog failed"))

        with self.assertRaisesRegex(RuntimeError, "dialog failed"):
            native_file_dialogs._show_dialog(
                dialog,
                initial_dir="images",
                dialog_x=20,
                dialog_y=30,
            )

        root.destroy.assert_called_once_with()


if __name__ == "__main__":
    unittest.main()
