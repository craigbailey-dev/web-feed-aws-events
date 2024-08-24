import jsonschema2md
import json
import os
import glob

parser = jsonschema2md.Parser()

schema_folder = os.path.join(os.path.dirname(os.path.dirname(os.path.realpath(__file__))), "docs/schema")

for json_schema_file in glob.glob(os.path.join(schema_folder, "*.json")):
    with open(json_schema_file) as infile:
        schema = json.load(infile)
        markdown = "".join(parser.parse_schema(schema)).replace("[#/$defs/", "[").replace(" : Refer", " Refer")
    with open(os.path.join(schema_folder, f"{schema["$id"]}.schema.md"), "w") as outfile:
        outfile.write(markdown)
