"""A simple Python module"""

class Counter:
    def __init__(self):
        self.value = 0

    def increment(self, amount=1):
        self.value += amount
        return self.value

    def reset(self):
        self.value = 0


def format_count(value):
    return f"Count: {value}"


def main():
    counter = Counter()
    counter.increment(5)
    counter.increment(3)
    result = format_count(counter.value)
    print(result)


if __name__ == "__main__":
    main()
