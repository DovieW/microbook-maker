import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location(
    'content_audit', pathlib.Path(__file__).parents[1] / 'tools' / 'verify-content.py')
audit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(audit)


class OpeningHeaderAudit(unittest.TestCase):
    title = 'A very long book title'
    byline = 'An author · 1884'
    stats = '3 sheets · 30,245 words · about 2h 21m'

    def matches(self, text, byline=None):
        return audit.opening_headers(text, self.title, self.byline if byline is None else byline, self.stats)

    def test_accepts_full_and_truncated_metadata(self):
        self.assertTrue(self.matches(f'{self.title}\n{self.byline}\n{self.stats}'))
        self.assertTrue(self.matches(f'A very long…\nAn author…\n{self.stats}'))
        self.assertTrue(self.matches(f'A very long…\n{self.stats}', byline=''))

    def test_rejects_wrong_or_missing_metadata(self):
        for title in ['Different title…', 'very long…', '…', '']:
            self.assertFalse(self.matches(f'{title}\n{self.byline}\n{self.stats}'))
        self.assertFalse(self.matches(f'{self.title}\nWrong author\n{self.stats}'))

    def test_counts_and_duration_must_be_exact(self):
        for stats in [self.stats.replace('3 sheets', '4 sheets'),
                      self.stats.replace('30,245', '30,244'),
                      self.stats.replace('21m', '22m'), '3 sheets…']:
            self.assertFalse(self.matches(f'{self.title}\n{self.byline}\n{stats}'))


if __name__ == '__main__':
    unittest.main()
