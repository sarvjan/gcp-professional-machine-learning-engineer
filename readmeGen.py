import sys
import math

def generate_readme(max_number):
    # Determine the number of columns based on max_number, with each column accommodating up to 10 questions
    columns = math.ceil(max_number / 10)  # Each column can hold up to 10 questions

    # Calculate the number of rows needed based on max_number and the column limit
    rows = min(10, max_number)  # Limit to a maximum of 10 rows for display purposes

    readme_content = "## Questions\n"
    readme_content += "|" + " | ".join([""] * columns) + "|\n"  # Empty row for columns
    readme_content += "|" + " | ".join(["-"] * columns) + "|\n"  # Separator row

    # Prepare a matrix with a fixed number of rows and a dynamic number of columns
    matrix = [["" for _ in range(columns)] for _ in range(rows)]
    
    # Fill the matrix by columns first
    for i in range(max_number):
        col = i // rows  # Determine which column to place the question
        row = i % rows   # Determine the position in the column
        matrix[row][col] = f"[question-{i + 1}](./q/question-{i + 1}.pdf)"
    
    # Add each row to the markdown content
    for row in matrix:
        readme_content += "|" + " | ".join(row) + "|\n"

    # Save the README.md file
    with open("README.md", "w") as file:
        file.write(readme_content)

# Example usage:
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python readmeGen.py <max_number>")
        sys.exit(1)

    try:
        max_number = int(sys.argv[1])
        if max_number < 1:
            raise ValueError("Input must be a positive integer.")
        generate_readme(max_number)
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
